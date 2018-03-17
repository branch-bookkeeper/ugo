const mongoManager = require('./manager-mongo');
const logger = require('./logger');
const postal = require('postal');
const { pathOr } = require('ramda');
const COLLECTION_NAME = 'queue';

class QueueManager {
    static deleteQueue(owner) {
        return mongoManager.getCollection(COLLECTION_NAME)
            .then(collection => collection.deleteMany({ owner }))
            .then(() => owner);
    }

    static addItem(owner, repo, branch, item) {
        const { pullRequestNumber } = item;

        return mongoManager.getCollection(COLLECTION_NAME)
            .then(collection => collection.findOneAndUpdate(
                {
                    _id: `${owner}-${repo}-${branch}`,
                    'queue.pullRequestNumber': { $ne: pullRequestNumber },
                },
                {
                    $set: {
                        owner,
                        repo,
                    },
                    $push: {
                        queue: {
                            ...item,
                            createdAt: new Date(item.createdAt),
                        },
                    },
                },
                {
                    returnOriginal: false,
                    upsert: true,
                }
            ))
            .then(({ value }) => {
                const queue = pathOr([], ['queue'], value);

                postal.publish({
                    channel: 'queue',
                    topic: 'item.add',
                    data: {
                        owner,
                        repo,
                        branch,
                        item,
                        index: queue.length - 1,
                    },
                });
            })
            .catch(e => {
                if (e.code === 11000) {
                    logger.error(`PR #${pullRequestNumber} already present in ${owner}/${repo} ${branch}`);
                } else {
                    logger.error(e);
                }
            });
    }

    static removeItem(owner, repo, branch, item, meta = {}) {
        const { pullRequestNumber, username } = item;

        return mongoManager.getCollection(COLLECTION_NAME)
            .then(collection => collection.findOneAndUpdate(
                {
                    _id: `${owner}-${repo}-${branch}`,
                },
                {
                    $pull: {
                        queue: {
                            username,
                            pullRequestNumber,
                        },
                    },
                }
            ))
            .then(({ value }) => {
                const queueFirstItemPullRequestNumber = pathOr(undefined, ['queue', 0, 'pullRequestNumber'], value);

                meta.firstItemChanged = queueFirstItemPullRequestNumber === pullRequestNumber;

                postal.publish({
                    channel: 'queue',
                    topic: 'item.remove',
                    data: {
                        owner,
                        repo,
                        branch,
                        item,
                        meta,
                    },
                });
            });
    }

    static getItems(owner, repo, branch, numberOfItems = Number.MAX_SAFE_INTEGER) {
        return mongoManager.getCollection(COLLECTION_NAME)
            .then(collection => collection.findOne(
                {
                    _id: `${owner}-${repo}-${branch}`,
                },
                {
                    _id: false,
                    owner: false,
                    repo: false,
                    queue: {
                        $slice: numberOfItems,
                    },
                }
            ))
            .then(pathOr([], ['queue']));
    }

    static getItem(owner, repo, branch, pullRequestNumber) {
        return mongoManager.getCollection(COLLECTION_NAME)
            .then(collection => collection.findOne(
                {
                    _id: `${owner}-${repo}-${branch}`,
                },
                {
                    _id: false,
                    queue: {
                        $elemMatch: { pullRequestNumber },
                    },
                }
            ))
            .then(pathOr(undefined, ['queue', 0]));
    }

    static getFirstItem(owner, repo, branch) {
        return QueueManager.getItems(owner, repo, branch, 1)
            .then(pathOr(undefined, [0]));
    }

    static getLength(owner, repo, branch) {
        return mongoManager.getCollection(COLLECTION_NAME)
            .then(collection => collection.aggregate([
                {
                    $match: {
                        _id: `${owner}-${repo}-${branch}`,
                    },
                },
                {
                    $project: {
                        queue: { $size: '$queue' },
                        _id: false,
                    },
                },
            ])
                .toArray()
                .then(pathOr(0, [0, 'queue'])));
    }

    static enabled() {
        return mongoManager.enabled();
    }
}

module.exports = QueueManager;
