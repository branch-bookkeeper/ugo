const postal = require('postal');
const Github = require('./github');
const logger = require('./logger');
const { slice } = require('ramda');
const pullRequestManager = require('./manager-pullrequest');
const queueManager = require('./manager-queue');
const { unpackQueueName } = require('./helpers/queue-helpers');

const MAX_REPORTED_QUEUE_POSITION = 5;

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
        ? queueManager.getItems(queue, 1)
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
        setAllPullRequestsStatuses(queue),
    ]).catch(logger.error);
};

const setAllPullRequestsStatuses = queue => (
    queueManager.getItems(queue)
        .then(items => {
            const { owner, repo, branch } = unpackQueueName(queue);

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
