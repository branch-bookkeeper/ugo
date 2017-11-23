const postal = require('postal');
const Github = require('./github');
const logger = require('./logger');
const { slice } = require('ramda');
const pullRequestManager = require('./manager-pullrequest');
const queueManager = require('./manager-queue');

const MAX_REPORTED_QUEUE_POSITION = 5;

const addItem = ({
    owner,
    repo,
    branch,
    item,
    index,
}) => {
    const { pullRequestNumber, username } = item;

    if (index === 0) {
        postal.publish({
            channel: 'notification',
            topic: 'send.rebased',
            data: {
                owner,
                repo,
                pullRequestNumber,
                username,
            },
        });
    }

    return setPullRequestStatusByPosition({
        owner,
        repo,
        branch,
        pullRequestNumber,
        index,
    }).catch(logger.error);
};

const removeItem = ({
    owner,
    repo,
    branch,
    item,
    meta = {},
}) => {
    const { mergedByUsername, firstItemChanged } = meta;
    const { pullRequestNumber: removedPullRequestNumber } = item;

    const blockOrUnblockRemovedItem = pullRequestManager.getPullRequestInfo(owner, repo, removedPullRequestNumber)
        .then(pullRequestData => {
            if (pullRequestData) {
                const blockOrUnblock = mergedByUsername ? unblockPullRequest : blockPullRequest;
                const description = mergedByUsername ? `Merged by ${mergedByUsername}` : 'Book to merge';

                return blockOrUnblock({
                    ...pullRequestData,
                    owner,
                    repo,
                    branch,
                    description,
                });
            }
        });

    const notifyOnFirstItemChanged = firstItemChanged
        ? queueManager.getItems(owner, repo, branch, 1)
            .then(queueItems => {
                if (queueItems.length > 0) {
                    const [first] = queueItems;
                    const { pullRequestNumber, username } = first;

                    postal.publish({
                        channel: 'notification',
                        topic: 'send.rebased',
                        data: {
                            owner,
                            repo,
                            pullRequestNumber,
                            username,
                        },
                    });
                }
            })
        : Promise.resolve(null);

    return Promise.all([
        blockOrUnblockRemovedItem,
        notifyOnFirstItemChanged,
        setAllPullRequestsStatuses(owner, repo, branch),
    ]).catch(logger.error);
};

const setAllPullRequestsStatuses = (owner, repo, branch) => (
    queueManager.getItems(owner, repo, branch)
        .then(items => {
            return Promise.all(slice(0, MAX_REPORTED_QUEUE_POSITION + 1, items).map(({ pullRequestNumber }, index) => (
                setPullRequestStatusByPosition({
                    owner,
                    repo,
                    branch,
                    pullRequestNumber,
                    index,
                })
            )));
        })
);

const setPullRequestStatusByPosition = ({
    owner,
    repo,
    branch,
    pullRequestNumber,
    index,
}) => {
    const blockOrUnblock = pullRequestData => {
        if (index === 0) {
            return unblockPullRequest({
                ...pullRequestData,
                owner,
                repo,
                branch,
            });
        }

        const description = (index <= MAX_REPORTED_QUEUE_POSITION)
            ? `${index} PR${index === 1 ? '' : 's'} before you`
            : `More than ${MAX_REPORTED_QUEUE_POSITION} PRs before you`;

        return blockPullRequest({
            ...pullRequestData,
            owner,
            repo,
            branch,
            description,
        });
    };

    return pullRequestManager.getPullRequestInfo(owner, repo, pullRequestNumber)
        .then(pullRequestData => pullRequestData && blockOrUnblock(pullRequestData));
};

const updatePullRequestStatus = ({
    owner, repo, branch, pullRequestNumber, status, description, statusUrl, installationId,
}) => {
    const targetUrl = `${process.env.APP_ORIGIN}/${owner}/${repo}/${branch}/${pullRequestNumber}`;

    return Github.updatePullRequestStatus({
        installationId,
        statusUrl,
        description,
        status,
        targetUrl,
    });
};

const blockPullRequest = (options) => {
    return updatePullRequestStatus({
        status: Github.STATUS_FAILURE,
        description: 'It\'s not your turn',
        ...options,
    });
};

const unblockPullRequest = (options) => {
    return updatePullRequestStatus({
        status: Github.STATUS_SUCCESS,
        description: 'It\'s your turn',
        ...options,
    });
};

const reportAddItem = ({
    owner,
    repo,
    branch,
}) => {
    postal.publish({
        channel: 'metrics',
        topic: 'increment',
        data: {
            name: 'queue.item.add',
            tags: [`queue:${owner}:${repo}:${branch}`],
        },
    });
};

const reportRemoveItem = ({
    owner,
    repo,
    branch,
}) => {
    postal.publish({
        channel: 'metrics',
        topic: 'increment',
        data: {
            name: 'queue.item.remove',
            tags: [`queue:${owner}:${repo}:${branch}`],
        },
    });
};

const reportQueueSize = ({
    owner,
    repo,
    branch,
}) => {
    queueManager.getLength(owner, repo, branch)
        .then(length => {
            postal.publish({
                channel: 'metrics',
                topic: 'gauge',
                data: {
                    name: 'queue.length',
                    value: length,
                    tags: [`queue:${owner}:${repo}:${branch}`],
                },
            });
        });
};

postal.subscribe({
    channel: 'queue',
    topic: 'item.add',
    callback: addItem,
});

postal.subscribe({
    channel: 'queue',
    topic: 'item.add',
    callback: reportAddItem,
});

postal.subscribe({
    channel: 'queue',
    topic: 'item.remove',
    callback: removeItem,
});

postal.subscribe({
    channel: 'queue',
    topic: 'item.remove',
    callback: reportRemoveItem,
});

postal.subscribe({
    channel: 'queue',
    topic: 'item.*',
    callback: reportQueueSize,
});
