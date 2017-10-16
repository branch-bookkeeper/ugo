/* globals test, setup, suiteSetup, suite */
const assert = require('chai').assert;
const queueManager = require('../manager-queue');
const redis = require('../redis');
let randomQueue;
let randomObject;

suite('QueueManager', () => {
    suiteSetup(function () {
        randomQueue = Math.random().toString(36).substr(2, 7);
        randomObject = { pullRequestNumber: Math.round(Math.random() * 100) };

        if (!redis.enabled()) {
            this.skip();
        }
    });

    setup(done => {
        redis.reset()
            .then(() => done())
            .catch(done);
    });

    test('Add item', () => {
        return queueManager.getItems(randomQueue)
            .then(items => {
                assert.isArray(items);
                assert.empty(items);
            })
            .then(() => queueManager.addItem(randomQueue, randomObject))
            .then(() => queueManager.getItems(randomQueue))
            .then(items => {
                assert.isArray(items);
                assert.notEmpty(items);
                assert.lengthOf(items, 1);
            });
    });

    test('Remove item', () => {
        return queueManager.getItems(randomQueue)
            .then(items => {
                assert.isArray(items);
                assert.empty(items);
            })
            .then(() => queueManager.addItem(randomQueue, randomObject))
            .then(() => queueManager.getItems(randomQueue))
            .then(items => {
                assert.isArray(items);
                assert.notEmpty(items);
                assert.lengthOf(items, 1);
            })
            .then(() => queueManager.removeItem(randomQueue, randomObject))
            .then(() => queueManager.getItems(randomQueue))
            .then(items => {
                assert.isArray(items);
                assert.empty(items);
            });
    });

    test('Add duplicate item', () => {
        return queueManager.getItems(randomQueue)
            .then(items => {
                assert.isArray(items);
                assert.empty(items);
            })
            .then(() => queueManager.addItem(randomQueue, randomObject))
            .then(() => queueManager.addItem(randomQueue, randomObject))
            .then(() => queueManager.getItems(randomQueue))
            .then(items => {
                assert.isArray(items);
                assert.notEmpty(items);
                assert.lengthOf(items, 1);
            });
    });
});
