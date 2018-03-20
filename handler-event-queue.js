const postal = require('postal');
const logger = require('./logger');
const pullRequestHandler = require('./handler-pullrequest');
const queueManager = require('./manager-queue');

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
                branch,
                pullRequestNumber,
                username,
            },
        });
    }

    return pullRequestHandler.setPullRequestStatusByPosition({
        owner,
        repo,
        pullRequestNumber,
        index,
    })
        .catch(logger.error);
};

const removeItem = ({
    owner,
    repo,
    branch,
    item,
    meta = {},
}) => {
    const { closed, firstItemChanged } = meta;
    const { pullRequestNumber } = item;
    const blockRemovedItem = closed ? Promise.resolve() : pullRequestHandler.blockPullRequest({
        owner,
        repo,
        pullRequestNumber,
    });

    const notifyOnFirstItemChanged = firstItemChanged
        ? queueManager.getFirstItem(owner, repo, branch)
            .then(first => {
                if (first) {
                    const { pullRequestNumber, username } = first;

                    postal.publish({
                        channel: 'notification',
                        topic: 'send.rebased',
                        data: {
                            owner,
                            repo,
                            branch,
                            pullRequestNumber,
                            username,
                        },
                    });
                }
            })
        : Promise.resolve();

    return Promise.all([
        blockRemovedItem,
        notifyOnFirstItemChanged,
        pullRequestHandler.setAllPullRequestsStatuses(owner, repo, branch),
    ])
        .catch(logger.error);
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
}) => postal.publish({
    channel: 'metrics',
    topic: 'increment',
    data: {
        name: 'queue.item.remove',
        tags: [`queue:${owner}:${repo}:${branch}`],
    },
});

const reportQueueSize = ({
    owner,
    repo,
    branch,
}) => queueManager.getLength(owner, repo, branch)
    .then(length => postal.publish({
        channel: 'metrics',
        topic: 'gauge',
        data: {
            name: 'queue.length',
            value: length,
            tags: [`queue:${owner}:${repo}:${branch}`],
        },
    }));

const pushQueueUpdate = ({
    owner,
    repo,
    branch,
}) => queueManager.getItems(owner, repo, branch)
    .then(items => postal.publish({
        channel: 'notification',
        topic: 'send.update',
        data: {
            owner,
            repo,
            branch,
            items,
        },
    }));

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

postal.subscribe({
    channel: 'queue',
    topic: 'item.*',
    callback: pushQueueUpdate,
});

module.exports = {
    addItem,
    reportAddItem,
    removeItem,
    reportRemoveItem,
    reportQueueSize,
    pushQueueUpdate,
};
