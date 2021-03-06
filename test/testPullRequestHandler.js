/* globals test, setup, suiteSetup, suite */
const { assert } = require('chai');
const sinon = require('sinon');
const pullRequestHandler = require('../handler-pullrequest');
const pullRequestManager = require('../manager-pullrequest');
const queueManager = require('../manager-queue');
const GitHub = require('../github');
const postal = require('postal');
const pullRequestOpenedFixture = require('./fixtures/pull_request.opened');
const pullRequestSynchronizedFixture = require('./fixtures/pull_request.synchronize');
const pullRequestClosedFixture = require('./fixtures/pull_request.closed');
const pullRequestMergedFixture = require('./fixtures/pull_request.merged');
const pullRequestInfoFixture = require('./fixtures/pull_request.info');
const statusSuccessPayload = require('./fixtures/status.success');
const queueItemFixture = require('./fixtures/queue.item');
const owner = 'branch-bookkeeper';
const repo = 'branch-bookkeeper';
const branch = 'master';
const pullRequestNumber = 1;
let gitHubSpy;
let gitHubHashSpy;
let gitHubHashCheckSuites;
let queueManagerGetItemSpy;
let queueManagerGetFirstItemSpy;
let queueManagerGetItemsSpy;
let queueManagerRemoveItemSpy;
let pullRequestManagerGetSpy;
let pullRequestManagerSetSpy;
let pullRequestManagerShaSpy;
let postalSpy;

sinon.assert.expose(assert, { prefix: '' });

suite('PullRequestHandler', () => {
    setup(function () {
        if (!pullRequestHandler.enabled()) {
            this.skip();
        }
        gitHubSpy = sinon.stub(GitHub, 'createCheckRunForPullRequest').resolves('');
        gitHubHashSpy = sinon.stub(GitHub, 'getHashStatus').resolves({ state: GitHub.STATUS_PENDING });
        gitHubHashCheckSuites = sinon.stub(GitHub, 'getHashCheckSuites').resolves({ check_suites: [{ conclusion: GitHub.CHECK_SUITE_CONCLUSION_SUCCESS }] });
        queueManagerGetItemSpy = sinon.stub(queueManager, 'getItem').resolves(queueItemFixture);
        queueManagerGetFirstItemSpy = sinon.stub(queueManager, 'getFirstItem').resolves(queueItemFixture);
        queueManagerGetItemsSpy = sinon.stub(queueManager, 'getItems').resolves([queueItemFixture]);
        queueManagerRemoveItemSpy = sinon.stub(queueManager, 'removeItem').resolves('');
        pullRequestManagerGetSpy = sinon.stub(pullRequestManager, 'getPullRequestInfo').resolves(pullRequestInfoFixture);
        pullRequestManagerSetSpy = sinon.stub(pullRequestManager, 'setPullRequestInfo').resolves('');
        pullRequestManagerShaSpy = sinon.stub(pullRequestManager, 'getPullRequestInfoBySha').resolves(pullRequestInfoFixture);
        postalSpy = sinon.stub(postal, 'publish');
    });

    teardown(() => {
        gitHubSpy.restore();
        gitHubHashSpy.restore();
        gitHubHashCheckSuites.restore();
        queueManagerGetItemSpy.restore();
        queueManagerGetFirstItemSpy.restore();
        queueManagerGetItemsSpy.restore();
        queueManagerRemoveItemSpy.restore();
        pullRequestManagerGetSpy.restore();
        pullRequestManagerSetSpy.restore();
        pullRequestManagerShaSpy.restore();
        postalSpy.restore();
    });

    test('Handle closed', () => {
        const { installationId, sha } = pullRequestInfoFixture;
        const { pull_request: pullRequest } = pullRequestClosedFixture;
        return pullRequestHandler.handleClosed(pullRequest)
            .then(() => {
                assert.calledWith(queueManagerGetItemSpy, owner, repo, branch, pullRequestNumber);
                assert.calledWith(
                    queueManagerRemoveItemSpy,
                    owner,
                    repo,
                    branch,
                    queueItemFixture,
                    {
                        closed: true,
                    }
                );
                assert.calledWith(pullRequestManagerGetSpy, owner, repo, pullRequestNumber);
                assert.calledWith(
                    gitHubSpy,
                    {
                        description: 'Not in the queue',
                        installationId,
                        status: GitHub.STATUS_FAILURE,
                        actions: undefined,
                        branch,
                        owner,
                        pullRequestNumber,
                        repo,
                        sha,
                    }
                );
            });
    });

    test('Handle merged', () => {
        const { installationId, sha } = pullRequestInfoFixture;
        const { pull_request: pullRequest } = pullRequestMergedFixture;
        return pullRequestHandler.handleClosed(pullRequest)
            .then(() => {
                assert.calledWith(queueManagerGetItemSpy, owner, repo, branch, pullRequestNumber);
                assert.calledWith(
                    queueManagerRemoveItemSpy,
                    owner,
                    repo,
                    branch,
                    queueItemFixture,
                    {
                        closed: true,
                    }
                );
                assert.calledWith(pullRequestManagerGetSpy, owner, repo, pullRequestNumber);
                assert.calledWith(
                    gitHubSpy,
                    {
                        description: 'Merged by branch-bookkeeper',
                        installationId,
                        status: GitHub.STATUS_SUCCESS,
                        actions: undefined,
                        branch,
                        owner,
                        pullRequestNumber,
                        repo,
                        sha,
                    }
                );
            });
    });

    test('Handle opened', () => {
        const { pull_request: pullRequest, pull_request: { head: { sha } }, installation: { id: installationId } } = pullRequestOpenedFixture;
        return pullRequestHandler.handleOpened(pullRequest, installationId)
            .then(() => {
                assert.calledWith(pullRequestManagerSetSpy, owner, repo, pullRequestNumber, pullRequestInfoFixture);
                assert.calledWith(
                    gitHubSpy,
                    {
                        description: 'Not in the queue',
                        installationId,
                        status: GitHub.STATUS_FAILURE,
                        actions: undefined,
                        branch,
                        owner,
                        pullRequestNumber,
                        repo,
                        sha,
                    }
                );
            });
    });

    [[], [queueItemFixture], [1, queueItemFixture], [1, 2, 3, 4, 5, 6, queueItemFixture]].forEach(queue => {
        const position = queue.length - 1;

        test(`Handle synchronize for item in position ${position}`, () => {
            queueManagerGetItemsSpy.resolves(queue);
            const { pull_request: pullRequest, pull_request: { head: { sha } }, installation: { id: installationId } } = pullRequestSynchronizedFixture;
            const pullRequestInfo = {
                ...pullRequestInfoFixture,
                assignees: [],
            };

            const status = queue.length === 1 ? GitHub.STATUS_SUCCESS : GitHub.STATUS_FAILURE;

            let description = 'First in the queue';
            if (position < 0) {
                description = 'Not in the queue';
            } else if (position > 0 && position < pullRequestHandler.MAX_REPORTED_QUEUE_POSITION) {
                description = '1 PR before this';
            } else if (position > pullRequestHandler.MAX_REPORTED_QUEUE_POSITION) {
                description = 'More than 5 PRs before this';
            }

            return pullRequestHandler.handleSync(pullRequest, installationId)
                .then(() => {
                    assert.calledWith(pullRequestManagerSetSpy, owner, repo, pullRequestNumber, pullRequestInfo);
                    assert.calledWith(queueManagerGetItemsSpy, owner, repo, branch);
                    assert.calledWith(gitHubSpy, {
                        description,
                        installationId,
                        status,
                        actions: undefined,
                        branch,
                        owner,
                        pullRequestNumber,
                        repo,
                        sha,
                    });
                });
        });
    });

    [GitHub.STATUS_SUCCESS, GitHub.STATUS_FAILURE].forEach(state => {
        test(`Handle status change success for first item GH reports ${state}`, () => {
            gitHubHashSpy.resolves({ state });
            const {
                sha,
                installation: { id: installationId },
                repository: { name: repo, owner: { login: owner } },
            } = statusSuccessPayload;
            const { username, pullRequestNumber } = queueItemFixture;
            return pullRequestHandler.handleStatusChange({
                owner,
                repo,
                sha,
            })
                .then(() => {
                    assert.calledWith(pullRequestManagerShaSpy, owner, repo, sha);
                    assert.calledWith(queueManagerGetFirstItemSpy, owner, repo, branch);
                    assert.calledWith(gitHubHashSpy, {
                        installationId,
                        owner,
                        repo,
                        sha,
                    });
                    assert.calledWith(postalSpy, {
                        channel: 'notification',
                        data: {
                            owner,
                            repo,
                            branch,
                            pullRequestNumber,
                            username,
                            state,
                        },
                        topic: 'send.checks',
                    });
                });
        });
    });

    test('Handle status change success for first item GH reports pending', () => {
        const {
            sha,
            installation: { id: installationId },
            repository: { name: repo, owner: { login: owner } },
        } = statusSuccessPayload;
        return pullRequestHandler.handleStatusChange({
            owner,
            repo,
            sha,
        })
            .then(() => {
                assert.calledWith(pullRequestManagerShaSpy, owner, repo, sha);
                assert.calledWith(queueManagerGetFirstItemSpy, owner, repo, branch);
                assert.calledWith(gitHubHashSpy, {
                    installationId,
                    owner,
                    repo,
                    sha,
                });
                assert.notCalled(postalSpy);
            });
    });

    test('Handle status change empty queue', () => {
        const { sha, repository: { name: repo, owner: { login: owner } } } = statusSuccessPayload;
        queueManagerGetFirstItemSpy.resolves(undefined);
        return pullRequestHandler.handleStatusChange({
            owner,
            repo,
            sha,
        })
            .then(() => {
                assert.calledWith(pullRequestManagerShaSpy, owner, repo, sha);
                assert.calledWith(queueManagerGetFirstItemSpy, owner, repo, branch);
                assert.notCalled(gitHubHashSpy);
                assert.notCalled(postalSpy);
            });
    });

    test('Handle status change item not in queue', () => {
        const { sha, repository: { name: repo, owner: { login: owner } } } = statusSuccessPayload;
        const firstItem = {
            ...queueItemFixture,
            pullRequestNumber: 2,
        };
        queueManagerGetFirstItemSpy.resolves(firstItem);
        return pullRequestHandler.handleStatusChange({
            owner,
            repo,
            sha,
        })
            .then(() => {
                assert.calledWith(pullRequestManagerShaSpy, owner, repo, sha);
                assert.calledWith(queueManagerGetFirstItemSpy, owner, repo, branch);
                assert.notCalled(gitHubHashSpy);
                assert.notCalled(postalSpy);
            });
    });

    test('Handle status change item not first', () => {
        const { sha, repository: { name: repo, owner: { login: owner } } } = statusSuccessPayload;
        const firstItem = {
            ...queueItemFixture,
            pullRequestNumber: 2,
        };
        queueManagerGetFirstItemSpy.resolves([firstItem, queueItemFixture]);
        return pullRequestHandler.handleStatusChange({
            owner,
            repo,
            sha,
        })
            .then(() => {
                assert.calledWith(pullRequestManagerShaSpy, owner, repo, sha);
                assert.calledWith(queueManagerGetFirstItemSpy, owner, repo, branch);
                assert.notCalled(gitHubHashSpy);
                assert.notCalled(postalSpy);
            });
    });

    test('Block', () => {
        const { installationId, sha } = pullRequestInfoFixture;
        return pullRequestHandler.blockPullRequest({
            owner,
            repo,
            pullRequestNumber,
            description: 'Description',
        })
            .then(() => {
                assert.calledWith(pullRequestManagerGetSpy, owner, repo, pullRequestNumber);
                assert.calledWith(gitHubSpy, {
                    description: 'Description',
                    installationId,
                    status: GitHub.STATUS_FAILURE,
                    actions: undefined,
                    branch,
                    owner,
                    pullRequestNumber,
                    repo,
                    sha,
                });
            });
    });

    test('Unblock', () => {
        const { installationId, sha } = pullRequestInfoFixture;
        return pullRequestHandler.unblockPullRequest({
            owner,
            repo,
            pullRequestNumber,
            description: 'Description',
        })
            .then(() => {
                assert.calledWith(pullRequestManagerGetSpy, owner, repo, pullRequestNumber);
                assert.calledWith(gitHubSpy, {
                    description: 'Description',
                    installationId,
                    status: GitHub.STATUS_SUCCESS,
                    actions: undefined,
                    branch,
                    owner,
                    pullRequestNumber,
                    repo,
                    sha,
                });
            });
    });
});
