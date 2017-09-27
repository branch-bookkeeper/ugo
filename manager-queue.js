const redis = require('./redis');
const postal = require('postal');
const prefix = 'booking';

class QueueManager {
    static addItem(queue, item) {
        return redis.push(`${prefix}:${queue}`, item)
            .then(data => {
                postal.publish({
                    channel: 'queue',
                    topic: 'item.add',
                    data: {
                        queue,
                        item,
                    },
                });
                return data;
            });
    }

    static removeItem(queue, item, meta) {
        return redis.lrem(`${prefix}:${queue}`, item)
            .then(() => {
                postal.publish({
                    channel: 'queue',
                    topic: 'item.remove',
                    data: {
                        queue,
                        item,
                        meta,
                    },
                });
            });
    }

    static getItems(queue) {
        return redis.lrange(`${prefix}:${queue}`);
    }

    static enabled() {
        return redis.enabled();
    }
}

module.exports = QueueManager;
