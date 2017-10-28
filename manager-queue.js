const redis = require('./redis');
const postal = require('postal');
const prefix = 'booking';

class QueueManager {
    static addItem(queue, item) {
        const [owner, repo] = queue.split(':');
        const { pullRequestNumber } = item;

        return redis.sismember(`${prefix}-index:${owner}:${repo}`, { pullRequestNumber })
            .then(isPresent => redis.sadd(`${prefix}-index:${owner}:${repo}`, { pullRequestNumber })
                .then(() => isPresent ? '' : redis.push(`${prefix}:${queue}`, item)))
            .then(() => {
                postal.publish({
                    channel: 'queue',
                    topic: 'item.add',
                    data: {
                        queue,
                        item,
                    },
                });
            });
    }

    static removeItem(queue, item, meta = {}) {
        const [owner, repo] = queue.split(':');
        const { pullRequestNumber } = item;

        return redis.lrange(`${prefix}:${queue}`, 1)
            .then(([queueFirstItem]) => {
                if (queueFirstItem) {
                    meta.firstItemChanged = queueFirstItem.pullRequestNumber === item.pullRequestNumber;
                }

                postal.publish({
                    channel: 'queue',
                    topic: 'item.remove',
                    data: {
                        queue,
                        item,
                        meta,
                    },
                });

                return redis.lrem(`${prefix}:${queue}`, item)
                    .then(() => redis.srem(`${prefix}-index:${owner}:${repo}`, { pullRequestNumber }));
            });
    }

    static getItems(queue, numberOfItems) {
        return redis.lrange(`${prefix}:${queue}`, numberOfItems);
    }

    static getLength(queue) {
        return redis.llen(`${prefix}:${queue}`);
    }

    static enabled() {
        return redis.enabled();
    }
}

module.exports = QueueManager;
