/* globals test, suiteSetup, setup, suite */
const assert = require('chai').assert;
const redis = require('../redis');
let randomKey;
let randomObject;

suite('Redis', () => {
    suiteSetup(function () {
        randomKey = Math.random().toString(36).substr(2, 7);
        randomObject = { data: randomKey };
    });

    setup(function (done) {
        if (redis.enabled()) {
            redis.reset()
                .then(() => done())
                .catch(done);
        } else {
            done();
        }
    });

    test('redis keys', (done) => {
        redis.keys(randomKey)
            .then(data => {
                assert.isArray(data);
                assert.empty(data);
                done();
            })
            .catch(err => {
                assert.isNotNull(err);
                done();
            });
    });

    test('redis get', (done) => {
        redis.get(randomKey)
            .then(data => {
                assert.isArray(data);
                assert.empty(data);
                done();
            })
            .catch(err => {
                assert.isNotNull(err);
                done();
            });
    });

    test('redis hget', (done) => {
        redis.hget(randomKey, randomKey)
            .then(data => {
                assert.isArray(data);
                assert.empty(data);
                done();
            })
            .catch(err => {
                assert.isNotNull(err);
                done();
            });
    });

    test('redis sadd', (done) => {
        redis.sadd(randomKey, randomKey)
            .then(data => {
                assert.isArray(data);
                assert.empty(data);
                done();
            })
            .catch(err => {
                assert.isNotNull(err);
                done();
            });
    });

    test('redis srem', (done) => {
        redis.srem(randomKey, randomKey)
            .then(data => {
                assert.isArray(data);
                assert.empty(data);
                done();
            })
            .catch(err => {
                assert.isNotNull(err);
                done();
            });
    });

    test('redis sismember', (done) => {
        redis.sismember(randomKey, randomObject)
            .then(data => {
                assert.isArray(data);
                assert.empty(data);
                done();
            })
            .catch(err => {
                assert.isNotNull(err);
                done();
            });
    });

    test('redis lrange', (done) => {
        redis.lrange(randomKey)
            .then(data => {
                assert.isArray(data);
                assert.empty(data);
                done();
            })
            .catch(err => {
                assert.isNotNull(err);
                done();
            });
    });

    test('redis llen', (done) => {
        redis.llen(randomKey)
            .then(data => {
                assert.isArray(data);
                assert.empty(data);
                done();
            })
            .catch(err => {
                assert.isNotNull(err);
                done();
            });
    });

    test('redis set', (done) => {
        redis.set(randomKey, randomObject)
            .then(data => {
                assert.isArray(data);
                assert.empty(data);
                done();
            })
            .catch(err => {
                assert.isNotNull(err);
                done();
            });
    });

    test('redis hset', (done) => {
        redis.hset(randomKey, randomKey, randomObject)
            .then(data => {
                assert.isArray(data);
                assert.empty(data);
                done();
            })
            .catch(err => {
                assert.isNotNull(err);
                done();
            });
    });

    test('redis del', (done) => {
        redis.del(randomKey, randomKey, randomObject)
            .then(data => {
                assert.isArray(data);
                assert.empty(data);
                done();
            })
            .catch(err => {
                assert.isNotNull(err);
                done();
            });
    });

    test('redis hdel', (done) => {
        redis.hdel(randomKey, randomKey)
            .then(data => {
                assert.isArray(data);
                assert.empty(data);
                done();
            })
            .catch(err => {
                assert.isNotNull(err);
                done();
            });
    });

    test('redis push', (done) => {
        redis.push(randomKey, randomObject)
            .then(data => {
                assert.isArray(data);
                assert.empty(data);
                done();
            })
            .catch(err => {
                assert.isNotNull(err);
                done();
            });
    });

    test('redis lrem', (done) => {
        redis.lrem(randomKey, randomObject)
            .then(data => {
                assert.isArray(data);
                assert.empty(data);
                done();
            })
            .catch(err => {
                assert.isNotNull(err);
                done();
            });
    });
});
