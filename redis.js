const redisLib = require('redis');
const async = require('async');
const logger = require('./logger');
const EventEmitter = require('events');
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
                redis.emit('lrem', { data: data, key: key });
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
    del(key) {
        return rejectIfNotConnected((resolve, reject) => {
            if (key) {
                redisClient.del(key, (e, d) => e ? reject(e) : resolve(d));
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
    mlrange(namespace) {
        return rejectIfNotConnected((resolve, reject) => {
            this.keys(`${namespace}`, (error, keys) => {
                if (error) {
                    reject(error);
                } else {
                    async.map(keys, (key, done) => this.lrange(key, (error, data) => {
                        done(error, {
                            key: key,
                            value: data,
                        });
                    }), resolve);
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
