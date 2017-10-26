const postal = require('postal');
const Github = require('./github');
const logger = require('./logger');
const { tail } = require('ramda');
const pullRequestManager = require('./manager-pullrequest');
const queueManager = require('./manager-queue');

const addItem = ({ queue }) => {
    const [owner, repo, branch] = queue.split(':');

    Promise.all([
        blockAllPullRequests(queue),
        queueManager.getItems(queue, 2),
    ])
        .then(([, queueItems]) => {
            if (queueItems.length > 0) {
                const [first] = queueItems;
                const { pullRequestNumber, username } = first;

                if (queueItems.length === 1) {
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

                return Promise.all([
                    pullRequestManager.getPullRequestInfo(owner, repo, pullRequestNumber),
                    Promise.resolve(pullRequestNumber),
                ]);
            }
            return Promise.resolve([null, null]);
        })
        .then(([pullRequestData, pullRequestNumber]) => {
            if (pullRequestData) {
                return unblockPullRequest({
                    ...pullRequestData,
                    owner,
                    repo,
                    branch,
                    pullRequestNumber,
                });
            }
            return Promise.resolve(null);
        })
        .catch(logger.error);
};

const removeItem = ({ queue, item, meta = {} }) => {
    const { mergedByUsername, firstItemChanged } = meta;
    const [owner, repo, branch] = queue.split(':');
    const { pullRequestNumber } = item;

    pullRequestManager.getPullRequestInfo(owner, repo, pullRequestNumber)
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
                    pullRequestNumber: item.pullRequestNumber,
                });
            }
            return Promise.resolve(null);
        })
        .then(() => queueManager.getItems(queue, 1))
        .then(queueItems => {
            if (queueItems.length > 0) {
                const [first] = queueItems;
                const { pullRequestNumber, username } = first;

                if (firstItemChanged) {
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

                return Promise.all([
                    pullRequestManager.getPullRequestInfo(owner, repo, pullRequestNumber),
                    Promise.resolve(pullRequestNumber),
                ]);
            }
            return Promise.resolve([null, null]);
        })
        .then(([pullRequestData, pullRequestNumber]) => {
            if (pullRequestData) {
                return unblockPullRequest({
                    ...pullRequestData,
                    owner,
                    repo,
                    branch,
                    pullRequestNumber,
                });
            }
        })
        .then(() => blockAllPullRequests(queue))
        .catch(logger.error);
};

const blockAllPullRequests = (queue) => {
    return queueManager.getItems(queue)
        .then(items => {
            const [owner, repo, branch] = queue.split(':');
            return Promise.all(tail(items).map(({ pullRequestNumber }, index) => {
                return pullRequestManager.getPullRequestInfo(owner, repo, pullRequestNumber)
                    .then(pullRequestData => {
                        if (pullRequestData) {
                            return blockPullRequest({
                                ...pullRequestData,
                                owner,
                                repo,
                                branch,
                                pullRequestNumber,
                                description: `${index + 1} PR before you`,
                            });
                        }
                        return Promise.resolve(null);
                    });
            }));
        });
};

const updatePullRequestStatus = (options) => {
    const {
        owner, repo, branch, pullRequestNumber,
    } = options;

    const targetUrl = `${process.env.APP_ORIGIN}/${owner}/${repo}/${branch}/${pullRequestNumber}`;

    return Github.updatePullRequestStatus({
        ...options,
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

const reportAddItem = ({ queue }) => {
    postal.publish({
        channel: 'metrics',
        topic: 'increment',
        data: {
            name: 'queue.item.add',
            tags: [`queue:${queue}`],
        },
    });
};

const reportRemoveItem = ({ queue }) => {
    postal.publish({
        channel: 'metrics',
        topic: 'increment',
        data: {
            name: 'queue.item.remove',
            tags: [`queue:${queue}`],
        },
    });
};

const reportQueueSize = ({ queue }) => {
    queueManager.getLength(queue)
        .then(length => {
            postal.publish({
                channel: 'metrics',
                topic: 'gauge',
                data: {
                    name: 'queue.length',
                    value: length,
                    tags: [`queue:${queue}`],
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
