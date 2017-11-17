/* globals test, setup, suiteSetup, suite */
const { assert } = require('chai');
const queueManager = require('../manager-queue');
const mongoManager = require('../manager-mongo');
const owner = 'branch-bookkeeper';
const repo = 'branch-bookkeeper';
const branch = 'master';
const randomObject = { username: 'branch-bookkeeper' };

suite('QueueManager', () => {
    suiteSetup(function () {
        if (!queueManager.enabled()) {
            this.skip();
        }
    });

    setup(() => {
        randomObject.pullRequestNumber = Math.round(Math.random() * 100);
        return mongoManager.reset();
    });

    test('Get items', () => {
        return queueManager.getItems(owner, repo, branch)
            .then(items => {
                assert.isArray(items);
                assert.empty(items);
            });
    });

    test('Add item', () => {
        return queueManager.addItem(owner, repo, branch, randomObject)
            .then(() => queueManager.getItems(owner, repo, branch))
            .then(items => {
                assert.isArray(items);
                assert.notEmpty(items);
                assert.lengthOf(items, 1);
            });
    });

    test('Remove item', () => {
        return queueManager.addItem(owner, repo, branch, randomObject)
            .then(() => queueManager.getItems(owner, repo, branch))
            .then(items => {
                assert.isArray(items);
                assert.notEmpty(items);
                assert.lengthOf(items, 1);
            })
            .then(() => queueManager.removeItem(owner, repo, branch, randomObject))
            .then(() => queueManager.getItems(owner, repo, branch))
            .then(items => {
                assert.isArray(items);
                assert.empty(items);
            });
    });

    test('Add duplicate item', () => {
        return queueManager.addItem(owner, repo, branch, randomObject)
            .then(() => queueManager.addItem(owner, repo, branch, randomObject))
            .then(() => queueManager.getItems(owner, repo, branch))
            .then(items => {
                assert.isArray(items);
                assert.notEmpty(items);
                assert.lengthOf(items, 1);
            });
    });
});
