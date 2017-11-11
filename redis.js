const redisLib = require('redis');
const logger = require('./logger');
const EventEmitter = require('events');
const { identity } = require('ramda');
let redisClient;

if (process.env['REDIS_URL']) {
    redisClient = redisLib.createClient(
        process.env['REDIS_URL'],
        {
            prefix: process.env['NODE_ENV'] ? process.env['NODE_ENV'] + ':' : '',
        }
    );
}

const rejectIfNotConnected = (resolve, reject) => {
    if (!process.env['REDIS_URL'] || !redisClient || !redisClient.ready) {
        return Promise.reject(new Error('queue not connected'));
    }

    return new Promise(resolve, reject);
};

const redis = Object.assign({
    enabled() {
        return process.env['REDIS_URL'] !== undefined;
    },
    lrem(key, data) {
        return rejectIfNotConnected((resolve, reject) => {
            redisClient.lrem(key, 0, JSON.stringify(data), (err, reply) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(JSON.parse(reply));
                }
            });
        });
    },
    push(key, data) {
        return rejectIfNotConnected((resolve, reject) => {
            if (key && data) {
                redisClient.rpush(key, JSON.stringify(data), (e, d) => e ? reject(e) : resolve(d));
            }
        });
    },
    set(key, data, ttl) {
        return rejectIfNotConnected((resolve, reject) => {
            if (key && data) {
                const callback = (e, d) => e ? reject(e) : resolve(d);
                const jsonData = JSON.stringify(data);

                if (ttl) {
                    redisClient.set(key, jsonData, 'EX', ttl || Number.MAX_SAFE_INTEGER, callback);
                } else {
                    redisClient.set(key, jsonData, callback);
                }
            }
        });
    },
    hset(key, field, data) {
        return rejectIfNotConnected((resolve, reject) => {
            if (key && field && data) {
                redisClient.hset(key, field, JSON.stringify(data), (e, d) => e ? reject(e) : resolve(d));
            }
        });
    },
    del(keyOrKeys) {
        return rejectIfNotConnected((resolve, reject) => {
            const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
            if (keys.length > 0) {
                redisClient.del(keys, (e, d) => e ? reject(e) : resolve(d));
            } else {
                resolve(0);
            }
        });
    },
    hdel(key, field) {
        return rejectIfNotConnected((resolve, reject) => {
            if (key && field) {
                redisClient.hdel(key, field, (e, d) => e ? reject(e) : resolve(d));
            }
        });
    },
    get(key) {
        return rejectIfNotConnected((resolve, reject) => {
            if (key) {
                redisClient.get(key, (err, data) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(JSON.parse(data));
                    }
                });
            }
        });
    },
    hget(key, field) {
        return rejectIfNotConnected((resolve, reject) => {
            if (key && field) {
                redisClient.hget(key, field, (err, data) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(JSON.parse(data));
                    }
                });
            }
        });
    },
    mget(keys) {
        return rejectIfNotConnected((resolve, reject) => {
            if (keys && keys.length > 0) {
                redisClient.mget(keys, (err, data) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(data.filter(identity).map(JSON.parse));
                    }
                });
            } else {
                resolve([]);
            }
        });
    },
    sadd(key, data) {
        return rejectIfNotConnected((resolve, reject) => {
            redisClient.sadd(key, JSON.stringify(data), (err, reply) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(reply);
                }
            });
        });
    },
    srem(key, data) {
        return rejectIfNotConnected((resolve, reject) => {
            redisClient.srem(key, JSON.stringify(data), (err, reply) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(reply);
                }
            });
        });
    },
    sismember(key, data) {
        return rejectIfNotConnected((resolve, reject) => {
            redisClient.sismember(key, JSON.stringify(data), (err, reply) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(reply === 1);
                }
            });
        });
    },
    lrange(key, numberOfItems) {
        return rejectIfNotConnected((resolve, reject) => {
            if (numberOfItems) {
                numberOfItems -= 1;
            } else {
                numberOfItems = Number.MAX_SAFE_INTEGER;
            }

            redisClient.lrange(key, 0, numberOfItems, (err, reply) => {
                if (!err) {
                    try {
                        resolve(reply.map(JSON.parse));
                    } catch (e) {
                        reject(e);
                    }
                } else {
                    reject(err);
                }
            });
        });
    },
    llen(queue) {
        return rejectIfNotConnected((resolve, reject) => {
            redisClient.llen(queue, (err, length) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(length);
                }
            });
        });
    },
    keys(pattern) {
        return rejectIfNotConnected((resolve, reject) => {
            redisClient.keys(`${redisClient.options.prefix}${pattern}:*`, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => row.replace(redisClient.options.prefix, '')));
                }
            });
        });
    },
    scan(pattern) {
        return rejectIfNotConnected((resolve, reject) => {
            let rows = [];
            const scanPattern = pattern && pattern.length
                ? `${redisClient.options.prefix}${pattern}:*`
                : `${redisClient.options.prefix}*`;

            const cb = (err, reply) => {
                if (err) {
                    return reject(err);
                }

                const [cursor, data] = reply;
                rows = rows.concat(data);

                if (cursor === '0') {
                    return resolve(rows.map(row => row.replace(redisClient.options.prefix, '')));
                }

                getData(cursor);
            };

            const getData = cursor => redisClient.scan(cursor, 'match', scanPattern, cb);

            getData('0');
        });
    },
    reset() {
        return rejectIfNotConnected((resolve, reject) => {
            this.scan()
                .then(keys => this.del(keys))
                .then(resolve)
                .catch(reject);
        });
    },
}, EventEmitter.prototype);

if (process.env['REDIS_URL'] && redisClient) {
    redisClient.on('error', error => {
        logger.error(error);
        redis.emit('error', error);
    });
    redisClient.on('ready', () => {
        logger.info('Connected to redis');
        redis.emit('ready');
    });
} else {
    logger.info('redis parameters missing, skipping connection');
    redis.emit('unavailable');
}

module.exports = redis;
