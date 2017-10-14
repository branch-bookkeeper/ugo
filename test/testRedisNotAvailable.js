/* globals test, suiteTeardown, suiteSetup, suite */
const assert = require('chai').assert;
const redis = require('../redis');
let randomKey;
let randomObject;

suite('Redis not available', () => {
    suiteSetup(function () {
        randomKey = Math.random().toString(36).substr(2, 7);
        randomObject = { data: randomKey };
    });

    test('redis enabled', () => {
        assert.isFalse(redis.enabled());
    });

    test('redis keys', (done) => {
        redis.keys(randomKey)
            .catch(err => {
                assert.isNotNull(err);
                done();
            });
    });

    test('redis get', (done) => {
        redis.get(randomKey)
            .catch(err => {
                assert.isNotNull(err);
                done();
            });
    });

    test('redis hget', (done) => {
        redis.hget(randomKey, randomKey)
            .catch(err => {
                assert.isNotNull(err);
                done();
            });
    });

    test('redis lrange', (done) => {
        redis.lrange(randomKey)
            .catch(err => {
                assert.isNotNull(err);
                done();
            });
    });

    test('redis set', (done) => {
        redis.set(randomKey, randomObject)
            .catch(err => {
                assert.isNotNull(err);
                done();
            });
    });

    test('redis hset', (done) => {
        redis.hset(randomKey, randomKey, randomObject)
            .catch(err => {
                assert.isNotNull(err);
                done();
            });
    });

    test('redis hdel', (done) => {
        redis.hdel(randomKey, randomKey)
            .catch(err => {
                assert.isNotNull(err);
                done();
            });
    });

    test('redis push', (done) => {
        redis.push(randomKey, randomObject)
            .catch(err => {
                assert.isNotNull(err);
                done();
            });
    });

    test('redis lrem', (done) => {
        redis.lrem(randomKey, randomObject)
            .catch(err => {
                assert.isNotNull(err);
                done();
            });
    });
});
