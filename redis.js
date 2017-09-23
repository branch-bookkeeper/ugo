const {
    map,
    fromPairs,
    compose,
    forEach,
    replace,
} = require('ramda');
const redisLib = require('redis');
const async = require('async');
const logger = require('./logger');
const EventEmitter = require('events');

const { REDIS_URL, NODE_ENV } = process.env;

const REDIS_CLIENT_METHODS = [
    'lrem',
    'rpush',
    'set',
    'hset',
    'del',
    'hdel',
    'get',
    'hget',
    'lrange',
    'keys',
];

const promisify = fun => function (...args) {
    return new Promise((resolve, reject) => (
        fun.apply(this, [...args, (error, result) => error ? reject(error) : resolve(result)])
    ));
};

const jsonParse = data => JSON.parse(data);

const createRedisClient = (redisUrl, nodeEnv = null) => {
    const client = redisLib.createClient(
        redisUrl,
        {
            prefix: nodeEnv ? nodeEnv + ':' : '',
        }
    );

    // Promisify every method we are going to use
    forEach(method => client[method] = promisify(client[method]), REDIS_CLIENT_METHODS);

    return client;
};

const createNotConnectedRedisClient = () => {
    const alwaysFail = () => Promise.reject(new Error('queue not connected'));

    return {
        ...compose(
            fromPairs,
            map(method => [method, alwaysFail])
        )(REDIS_CLIENT_METHODS),
        on: (event, callback) => event === 'unavailable' && callback(),
    };
};

const redisClient = REDIS_URL
    ? createRedisClient(REDIS_URL, NODE_ENV)
    : createNotConnectedRedisClient();

const redis = {
    enabled() {
        process.env.REDIS_URL !== undefined;
    },
    lrem(key, data) {
        redis.emit('lrem', { data: data, key: key });

        return redisClient.lrem(key, 0)
            .then(jsonParse);
    },
    push(key, data) {
        if (key && data) {
            return redisClient.rpush(key, JSON.stringify(data));
        }

        return Promise.reject('You must specify key and data');
    },
    set(key, data, ttl) {
        if (key && data) {
            const jsonData = JSON.stringify(data);

            if (ttl) {
                return redisClient.set(key, jsonData, 'EX', ttl);
            } else {
                return redisClient.set(key, jsonData);
            }
        }

        return Promise.reject('You must specify key and data');
    },
    hset(key, field, data) {
        if (key && field && data) {
            return redisClient.hset(key, field, JSON.stringify(data));
        }

        return Promise.reject('You must specify key, field and data');
    },
    del(key) {
        if (key) {
            return redisClient.del(key);
        }

        return Promise.reject('You must specify key');
    },
    hdel(key, field) {
        if (key && field) {
            return redisClient.hdel(key, field);
        }

        return Promise.reject('You must specify key and field');
    },
    get(key) {
        if (key) {
            return redisClient.get(key)
                .then(jsonParse);
        }

        return Promise.reject('You must specify key');
    },
    hget(key, field) {
        if (key && field) {
            return redisClient.hget(key, field)
                .then(jsonParse);
        }

        return Promise.reject('You must specify key and field');
    },
    lrange(key, numberOfItems) {
        if (numberOfItems) {
            numberOfItems -= 1;
        } else {
            numberOfItems = Number.MAX_SAFE_INTEGER;
        }

        return redisClient.lrange(key, 0, numberOfItems)
            .then(map(jsonParse));
    },
    keys(pattern) {
        return redisClient.keys(`${redisClient.options.prefix}${pattern}:*`)
            .then(map(replace(redisClient.options.prefix, '')));
    },
    ...EventEmitter.prototype,
};

redisClient.on('error', error => {
    logger.error(error);
    redis.emit('error', error);
});
redisClient.on('ready', () => {
    logger.info('Connected to redis');
    redis.emit('ready');
});
redisClient.on('unavailable', () => {
    logger.info('redis parameters missing, skipping connection');
    redis.emit('unavailable');
});

module.exports = redis;
