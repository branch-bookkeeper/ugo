const redisLib = require('redis');
const async = require('async');
const EventEmitter = require('events');
const eNC = new Error('redis not connected');

if (process.env['REDIS_URL']) {
    var redisClient = redisLib.createClient(
        process.env['REDIS_URL'],
        {
            prefix: process.env['NODE_ENV'] ? process.env['NODE_ENV'] + ':' : '',
        }
    );
}

const redis = Object.assign({
    enabled() {
        return process.env['REDIS_URL'] !== undefined;
    },
    lrem(key, data) {
        return new Promise((resolve, reject) => {
            if (!redisClient || !redisClient.ready) {
                reject(eNC);
                return;
            }
            redisClient.lrem(key, 0, JSON.stringify(data), (err, reply) => {
                redis.emit('lrem', {data: data, key: key});
                if (err) {
                    reject(err);
                } else {
                    resolve(JSON.parse(reply));
                }
            })
        });
    },
    push(key, data) {
        return new Promise((resolve, reject) => {
            if (!redisClient || !redisClient.ready) {
                reject(eNC);
                return;
            }
            if (key && data) {
                redisClient.rpush(key, JSON.stringify(data), resolve);
            }
        });
    },
    set(key, data) {
        return new Promise((resolve, reject) => {
            if (!redisClient || !redisClient.ready) {
                reject(eNC);
                return;
            }
            if (key && data) {
                redisClient.set(key, JSON.stringify(data), resolve);
            }
        });
    },
    get(key) {
        return new Promise((resolve, reject) => {
            if (!redisClient || !redisClient.ready) {
                reject(eNC);
                return;
            }
            if (key) {
                redisClient.get(key, (err, data) => {
                    if(err) {
                        reject(err);
                    } else {
                        resolve(JSON.parse(data));
                    }
                });
            }
        });
    },
    lrange(key) {
        return new Promise((resolve, reject) => {
            if (!redisClient || !redisClient.ready) {
                reject(eNC);
                return;
            }
            redisClient.lrange(key, 0, Number.MAX_SAFE_INTEGER, (err, reply) => {
                if (!err && reply.length) {
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
        return new Promise((resolve, reject) => {
            if (!redisClient || !redisClient.ready) {
                reject(eNC);
                return;
            }
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
        return new Promise((resolve, reject) => {
            if (!redisClient || !redisClient.ready) {
                reject(eNC);
                return;
            }
            redisClient.keys(`${redisClient.options.prefix}${pattern}:*`, (err, rows) => {
                if(err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => row.replace(redisClient.options.prefix, '')));
                }
            });
        });
    },
}, EventEmitter.prototype);

if (process.env['REDIS_URL'] && redisClient) {
    redisClient.on('error', function (error) {
        console.error(error);
        redis.emit('error', error);
    });
    redisClient.on('ready', function () {
        console.info('Connected to redis');
        redis.emit('ready');
    });
} else {
    console.info('redis parameters missing, skipping connection');
    redis.emit('unavailable');
}

module.exports = redis;
