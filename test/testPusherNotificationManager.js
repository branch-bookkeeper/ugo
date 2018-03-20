/* globals test, setup, suiteSetup, suite */
const { assert } = require('chai');
const sinon = require('sinon');
const pusher = require('pusher');
const pusherNotificationManager = require('../manager-notification-pusher');
const queueItemFixture = require('./fixtures/queue.item.json');
const owner = 'branch-bookkeeper';
const repo = 'branch-bookkeeper';
const branch = 'master';
const items = [queueItemFixture];

let pusherSpy;

sinon.assert.expose(assert, { prefix: '' });

suite('PusherNotificationManager', () => {
    setup(() => {
        pusherSpy = sinon.stub(pusher.prototype, 'trigger');
    });

    teardown(() => {
        pusherSpy.restore();
    });

    test('Send queue update', () => {
        pusherNotificationManager.sendQueueUpdate({
            owner,
            repo,
            branch,
            items,
        });
        assert.calledWith(pusherSpy, `${owner}-${repo}-${branch}`, 'queue.update', items);
    });
});
