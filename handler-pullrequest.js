const GitHub = require('./github');
const postal = require('postal');
const t = require('./manager-localization');
const {
    pluck,
    slice,
    findIndex,
    propEq,
} = require('ramda');
const queueManager = require('./manager-queue');
const pullRequestManager = require('./manager-pullrequest');

const MAX_REPORTED_QUEUE_POSITION = 5;
const DESCRIPTION_NOT_IN_QUEUE = t('pullRequest.queue.not');
const DESCRIPTION_FIRST = t('pullRequest.queue.first');
const ACTION_QUEUE_ADD_LABEL = t('checkRun.actions.add.label');
const ACTION_QUEUE_ADD_DESCRIPTION = t('checkRun.actions.add.description');
const ACTION_QUEUE_ADD_IDENTIFIER = 'queue-add';
const ACTION_QUEUE_REMOVE_LABEL = t('checkRun.actions.remove.label');
const ACTION_QUEUE_REMOVE_DESCRIPTION = t('checkRun.actions.remove.description');
const ACTION_QUEUE_REMOVE_IDENTIFIER = 'queue-remove';

const _getPullRequestAndUpdateStatus = (owner, repo, pullRequestNumber, status, description) => pullRequestManager.getPullRequestInfo(owner, repo, pullRequestNumber)
    .then(pullRequestData => {
        if (pullRequestData) {
            const {
                pullRequestNumber,
                branch,
                installationId,
                sha,
            } = pullRequestData;

            const actions = process.env.CHECK_RUN_ACTIONS === true ? [{
                label: description === DESCRIPTION_NOT_IN_QUEUE ? ACTION_QUEUE_ADD_LABEL : ACTION_QUEUE_REMOVE_LABEL,
                description: description === DESCRIPTION_NOT_IN_QUEUE ? ACTION_QUEUE_ADD_DESCRIPTION : ACTION_QUEUE_REMOVE_DESCRIPTION,
                identifier: description === DESCRIPTION_NOT_IN_QUEUE ? ACTION_QUEUE_ADD_IDENTIFIER : ACTION_QUEUE_REMOVE_IDENTIFIER,
            }] : undefined;

            return GitHub.createCheckRunForPullRequest({
                installationId,
                sha,
                status,
                description,
                actions,
                owner,
                repo,
                branch,
                pullRequestNumber,
            });
        }
    });

const _updatePullRequestInfo = (pullRequest, installationId) => {
    const {
        title,
        html_url: humanUrl,
        assignees,
        number: pullRequestNumber,
        base: { repo: { owner: { login: owner }, name: repo }, ref: branch },
        user: { login: author },
        head: { sha },
    } = pullRequest;

    return pullRequestManager.setPullRequestInfo(owner, repo, pullRequestNumber, {
        installationId,
        pullRequestNumber,
        title,
        author,
        humanUrl,
        branch,
        assignees: pluck('login', assignees),
        sha,
    })
        .then(() => ({
            owner,
            repo,
            branch,
            pullRequestNumber,
        }));
};

class PullRequestHandler {
    static handleClosed(pullRequest) {
        const {
            number: pullRequestNumber,
            base: {
                repo: baseRepo,
                ref: branch,
            },
            merged_by: mergeUser,
            merged,
        } = pullRequest;
        const { name: repo, owner: { login: owner } } = baseRepo;
        const { login: username } = merged ? mergeUser : {};
        const description = merged ? t('pullRequest.merged', { username }) : undefined;
        const blockOrUnblock = merged ? PullRequestHandler.unblockPullRequest : PullRequestHandler.blockPullRequest;

        return queueManager.getItem(owner, repo, branch, pullRequestNumber)
            .then(item => item && queueManager.removeItem(owner, repo, branch, item, { closed: true }))
            .then(() => blockOrUnblock({
                owner,
                repo,
                pullRequestNumber,
                description,
            }))
            .then(() => pullRequestManager.deletePullRequestInfo(owner, repo, pullRequestNumber))
            .then(() => ({
                owner,
                repo,
                branch,
                pullRequestNumber,
            }));
    }

    static handleOpened(pullRequest, installationId) {
        return _updatePullRequestInfo(pullRequest, installationId)
            .then(({
                owner,
                repo,
                branch,
                pullRequestNumber,
            }) => PullRequestHandler.blockPullRequest({
                owner,
                repo,
                pullRequestNumber,
            })
                .then(() => ({
                    owner,
                    repo,
                    branch,
                    pullRequestNumber,
                })));
    }

    static handleSync(pullRequest, installationId) {
        return _updatePullRequestInfo(pullRequest, installationId)
            .then(({
                owner,
                repo,
                branch,
                pullRequestNumber,
            }) => queueManager.getItems(owner, repo, branch)
                .then(bookingData => {
                    const index = findIndex(propEq('pullRequestNumber', pullRequestNumber))(bookingData);
                    return PullRequestHandler.setPullRequestStatusByPosition({
                        owner,
                        repo,
                        pullRequestNumber,
                        index,
                    });
                })
                .then(() => ({
                    owner,
                    repo,
                    branch,
                    pullRequestNumber,
                })));
    }

    static handleStatusChange({
        owner,
        repo,
        sha,
    }) {
        return pullRequestManager.getPullRequestInfoBySha(owner, repo, sha)
            .then(data => {
                if (!data) {
                    return Promise.resolve();
                }
                const {
                    branch,
                    installationId,
                    pullRequestNumber,
                    status: pullRequestStatus = GitHub.STATUS_PENDING,
                } = data;
                return queueManager.getFirstItem(owner, repo, branch)
                    .then(firstItem => {
                        if (!firstItem || firstItem.pullRequestNumber !== pullRequestNumber) {
                            return Promise.resolve();
                        }
                        return GitHub.getHashCombinedStatus({
                            installationId,
                            owner,
                            repo,
                            sha,
                        })
                            .then(githubStatus => {
                                const { username, pullRequestNumber } = firstItem;

                                pullRequestManager.setPullRequestInfo(owner, repo, pullRequestNumber, {
                                    status: githubStatus,
                                })
                                    .then(() => {
                                        if (githubStatus !== pullRequestStatus) {
                                            const topic = githubStatus === GitHub.STATUS_PENDING ? 'cancel.checks' : 'send.checks';
                                            postal.publish({
                                                channel: 'notification',
                                                topic,
                                                data: {
                                                    owner,
                                                    repo,
                                                    branch,
                                                    pullRequestNumber,
                                                    username,
                                                    state: githubStatus,
                                                },
                                            });
                                        }
                                    });
                            });
                    });
            });
    }

    static blockPullRequest({
        owner,
        repo,
        pullRequestNumber,
        description = DESCRIPTION_NOT_IN_QUEUE,
    }) {
        return _getPullRequestAndUpdateStatus(
            owner,
            repo,
            pullRequestNumber,
            GitHub.CHECK_SUITE_CONCLUSION_FAILURE,
            description
        );
    }

    static unblockPullRequest({
        owner,
        repo,
        pullRequestNumber,
        description = DESCRIPTION_FIRST,
    }) {
        return _getPullRequestAndUpdateStatus(
            owner,
            repo,
            pullRequestNumber,
            GitHub.CHECK_SUITE_CONCLUSION_SUCCESS,
            description
        );
    }

    static setAllPullRequestsStatuses(owner, repo, branch) {
        return queueManager.getItems(owner, repo, branch)
            .then(items => Promise.all(slice(0, MAX_REPORTED_QUEUE_POSITION + 1, items)
                .map(({ pullRequestNumber }, index) => (
                    PullRequestHandler.setPullRequestStatusByPosition({
                        owner,
                        repo,
                        pullRequestNumber,
                        index,
                    })
                ))));
    }

    static setPullRequestStatusByPosition({
        owner,
        repo,
        pullRequestNumber,
        index,
    }) {
        const blockOrUnblock = (owner, repo, pullRequestNumber) => {
            if (index === 0) {
                return PullRequestHandler.unblockPullRequest({
                    owner,
                    repo,
                    pullRequestNumber,
                });
            }

            let description;

            if (index < 0) {
                description = DESCRIPTION_NOT_IN_QUEUE;
            } else if (index <= MAX_REPORTED_QUEUE_POSITION) {
                description = t(index === 1 ? 'pullRequest.queue.second' : 'pullRequest.queue.position', { position: index });
            } else if (index > MAX_REPORTED_QUEUE_POSITION) {
                description = t('pullRequest.queue.over', { number: MAX_REPORTED_QUEUE_POSITION });
            }

            return PullRequestHandler.blockPullRequest({
                owner,
                repo,
                pullRequestNumber,
                description,
            });
        };

        return blockOrUnblock(owner, repo, pullRequestNumber);
    }

    static enabled() {
        return pullRequestManager.enabled();
    }
}

PullRequestHandler.MAX_REPORTED_QUEUE_POSITION = MAX_REPORTED_QUEUE_POSITION;
PullRequestHandler.ACTION_QUEUE_ADD_IDENTIFIER = ACTION_QUEUE_ADD_IDENTIFIER;
PullRequestHandler.ACTION_QUEUE_REMOVE_IDENTIFIER = ACTION_QUEUE_REMOVE_IDENTIFIER;

module.exports = PullRequestHandler;
