const redis = require('./redis');
const { unpackQueueName } = require('./helpers/queue-helpers');
const logger = require('./logger');
const postal = require('postal');
const prefix = 'booking';

class QueueManager {
    static addItem(queue, item) {
        const { owner, repo } = unpackQueueName(queue);
        const { pullRequestNumber } = item;

        return redis.sismember(`${prefix}-index:${owner}:${repo}`, { pullRequestNumber })
            .then(isPresent => {
                if (!isPresent) {
                    return redis.sadd(`${prefix}-index:${owner}:${repo}`, { pullRequestNumber })
                        .then(() => redis.push(`${prefix}:${queue}`, item))
                        .then(queueLength => {
                            postal.publish({
                                channel: 'queue',
                                topic: 'item.add',
                                data: {
                                    queue,
                                    item,
                                    index: queueLength - 1,
                                },
                            });
                        });
                }

                logger.error(`PR #${pullRequestNumber} already present in queue ${queue}`);
            });
    }

    static removeItem(queue, item, meta = {}) {
        const { owner, repo } = unpackQueueName(queue);
        const { pullRequestNumber } = item;

        return redis.lrange(`${prefix}:${queue}`, 1)
            .then(([queueFirstItem]) => {
                if (queueFirstItem) {
                    meta.firstItemChanged = queueFirstItem.pullRequestNumber === item.pullRequestNumber;
                }

                return redis.lrem(`${prefix}:${queue}`, item)
                    .then(() => redis.srem(`${prefix}-index:${owner}:${repo}`, { pullRequestNumber }))
                    .then(() => postal.publish({
                        channel: 'queue',
                        topic: 'item.remove',
                        data: {
                            queue,
                            item,
                            meta,
                        },
                    }));
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
