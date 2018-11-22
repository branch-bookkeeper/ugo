/* globals test, setup, suiteSetup, suite */
const { assert } = require('chai');
const queueManager = require('../manager-queue');
const mongoManager = require('../manager-mongo');
const queueItemFixture = require('./fixtures/queue.item');
const owner = 'branch-bookkeeper';
const repo = 'branch-bookkeeper';
const branch = 'master';
let queueItem;

suite('QueueManager', () => {
    suiteSetup(function () {
        if (!queueManager.enabled()) {
            this.skip();
        }
    });

    setup(() => {
        queueItem = {
            ...queueItemFixture,
            pullRequestNumber: Math.floor(Math.random() * 89) + 10,
            createdAt: new Date(queueItemFixture.createdAt),
        };

        return mongoManager.reset();
    });

    test('Get items', () => {
        const secondItem = { ...queueItem, pullRequestNumber: queueItem.pullRequestNumber + 1 };
        return queueManager.addItem(owner, repo, branch, queueItem)
            .then(() => queueManager.addItem(owner, repo, branch, secondItem))
            .then(() => queueManager.getItems(owner, repo, branch))
            .then(items => {
                assert.isArray(items);
                assert.notEmpty(items);
                assert.lengthOf(items, 2);
                assert.deepEqual([queueItem, secondItem], items);
            });
    });

    test('Get specific number of items', () => {
        const secondItem = { ...queueItem, pullRequestNumber: queueItem.pullRequestNumber + 1 };
        const numberOfItems = 1;
        return queueManager.addItem(owner, repo, branch, queueItem)
            .then(() => queueManager.addItem(owner, repo, branch, secondItem))
            .then(() => queueManager.getItems(owner, repo, branch, numberOfItems))
            .then(items => {
                assert.isArray(items);
                assert.notEmpty(items);
                assert.lengthOf(items, numberOfItems);
                assert.deepEqual([queueItem], items);
            });
    });

    test('Add item', () => {
        return queueManager.addItem(owner, repo, branch, queueItem)
            .then(() => queueManager.getItems(owner, repo, branch))
            .then(items => {
                assert.isArray(items);
                assert.notEmpty(items);
                assert.lengthOf(items, 1);
                assert.deepEqual([queueItem], items);
            });
    });

    test('Get item', () => {
        return queueManager.addItem(owner, repo, branch, queueItem)
            .then(() => queueManager.getItem(owner, repo, branch, queueItem.pullRequestNumber))
            .then(item => assert.deepEqual(queueItem, item));
    });

    test('Get not existing item', () => {
        return queueManager.addItem(owner, repo, branch, queueItem)
            .then(() => queueManager.getItem(owner, repo, queueItem.pullRequestNumber + 1))
            .then(item => assert.isUndefined(item));
    });

    test('Remove item', () => {
        return queueManager.addItem(owner, repo, branch, queueItem)
            .then(() => queueManager.getItems(owner, repo, branch))
            .then(items => {
                assert.isArray(items);
                assert.notEmpty(items);
                assert.lengthOf(items, 1);
            })
            .then(() => queueManager.removeItem(owner, repo, branch, queueItem))
            .then(() => queueManager.getItems(owner, repo, branch))
            .then(items => {
                assert.isArray(items);
                assert.empty(items);
            });
    });

    test('Add duplicate item', () => {
        return queueManager.addItem(owner, repo, branch, queueItem)
            .then(() => queueManager.addItem(owner, repo, branch, queueItem))
            .then(() => queueManager.getItems(owner, repo, branch))
            .then(items => {
                assert.isArray(items);
                assert.notEmpty(items);
                assert.lengthOf(items, 1);
            });
    });
});
