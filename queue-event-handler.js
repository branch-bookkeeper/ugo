const postal = require('postal');
const Github = require('./github');
const logger = require('./logger');
const { tail } = require('ramda');
const pullRequestManager = require('./manager-pullrequest');
const queueManager = require('./manager-queue');
const { unpackQueueName } = require('./helpers/queue-helpers');

const addItem = ({ queue, item, index }) => {
    const { owner, repo, branch } = unpackQueueName(queue);
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

const removeItem = ({ queue, item, meta = {} }) => {
    const { mergedByUsername, firstItemChanged } = meta;
    const { owner, repo, branch } = unpackQueueName(queue);
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

                return pullRequestManager.getPullRequestInfo(owner, repo, pullRequestNumber);
            }
            return Promise.resolve(null);
        })
        .then(pullRequestData => {
            if (pullRequestData) {
                return unblockPullRequest({
                    ...pullRequestData,
                    owner,
                    repo,
                    branch,
                });
            }
        })
        .then(() => blockAllPullRequests(queue))
        .catch(logger.error);
};

const blockAllPullRequests = (queue) => {
    return queueManager.getItems(queue)
        .then(items => {
            const { owner, repo, branch } = unpackQueueName(queue);
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

        return blockPullRequest({
            ...pullRequestData,
            owner,
            repo,
            branch,
            description: `${index} PR${index === 1 ? '' : 's'} before you`,
        });
    };

    return pullRequestManager.getPullRequestInfo(owner, repo, pullRequestNumber)
        .then(pullRequestData => pullRequestData && blockOrUnblock(pullRequestData));
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
