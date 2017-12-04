/* globals test, setup, suiteSetup, suite */
const { assert } = require('chai');
const queueManager = require('../manager-queue');
const mongoManager = require('../manager-mongo');
const owner = 'branch-bookkeeper';
const repo = 'branch-bookkeeper';
const branch = 'master';
const queueItemFixture = {
    ...require('./fixtures/queue.item.json'),
    pullRequestNumber: Math.floor(Math.random() * 89) + 10,
};

suite('QueueManager', () => {
    suiteSetup(function () {
        if (!queueManager.enabled()) {
            this.skip();
        }
    });

    setup(() => {
        return mongoManager.reset();
    });

    test('Get items', () => {
        return queueManager.getItems(owner, repo, branch)
            .then(items => {
                assert.isArray(items);
                assert.empty(items);
                assert.lengthOf(items, 0);
                assert.deepEqual([], items);
            });
    });

    test('Add item', () => {
        return queueManager.addItem(owner, repo, branch, queueItemFixture)
            .then(() => queueManager.getItems(owner, repo, branch))
            .then(items => {
                assert.isArray(items);
                assert.notEmpty(items);
                assert.lengthOf(items, 1);
                assert.deepEqual([{
                    ...queueItemFixture,
                    createdAt: new Date(queueItemFixture.createdAt),
                }], items);
            });
    });

    test('Get item', () => {
        return queueManager.addItem(owner, repo, branch, queueItemFixture)
            .then(() => queueManager.getItem(owner, repo, branch, queueItemFixture.pullRequestNumber))
            .then(item => assert.deepEqual(item, {
                ...queueItemFixture,
                createdAt: new Date(queueItemFixture.createdAt),
            }));
    });

    test('Get not existing item', () => {
        return queueManager.addItem(owner, repo, branch, queueItemFixture)
            .then(() => queueManager.getItem(owner, repo, queueItemFixture.pullRequestNumber + 1))
            .then(item => assert.isUndefined(item));
    });

    test('Remove item', () => {
        return queueManager.addItem(owner, repo, branch, queueItemFixture)
            .then(() => queueManager.getItems(owner, repo, branch))
            .then(items => {
                assert.isArray(items);
                assert.notEmpty(items);
                assert.lengthOf(items, 1);
            })
            .then(() => queueManager.removeItem(owner, repo, branch, queueItemFixture))
            .then(() => queueManager.getItems(owner, repo, branch))
            .then(items => {
                assert.isArray(items);
                assert.empty(items);
            });
    });

    test('Add duplicate item', () => {
        return queueManager.addItem(owner, repo, branch, queueItemFixture)
            .then(() => queueManager.addItem(owner, repo, branch, queueItemFixture))
            .then(() => queueManager.getItems(owner, repo, branch))
            .then(items => {
                assert.isArray(items);
                assert.notEmpty(items);
                assert.lengthOf(items, 1);
            });
    });
});
