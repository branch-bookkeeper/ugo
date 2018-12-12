/* globals test, setup, suiteSetup, suite */
const { assert } = require('chai');
const pushNotificationManager = require('../manager-notification-push');
const mongoManager = require('../manager-mongo');
const owner = 'owner';
const repo = 'repo';
const username = 'user';
const pullRequestNumber = 1;
const type = 'test';
const notificationId = 'owner-repo-1-user-test';
const notificationExternalId = 'ciao'

suite('PushNotificationManager', () => {
    suiteSetup(function () {
        if (!mongoManager.enabled()) {
            return this.skip();
        }

        return mongoManager.reset();
    });

    test('Save notification', () => {
        const fakeData = {
            owner,
            repo,
            pullRequestNumber,
            username,
            type,
            id: notificationExternalId,
        };
        return pushNotificationManager.saveNotification(fakeData)
            .then(data => {
                assert.deepEqual(data, fakeData);
            });
    });

    test('Get notification', () => {
        return pushNotificationManager.getNotification(notificationId)
            .then(data => {
                assert.deepEqual(data, {
                    id: notificationExternalId,
                });
            });
    });

    test('Delete notification', () => {
        return pushNotificationManager.deleteNotification(notificationId)
            .then(data => {
                assert.deepEqual(data, notificationId);
            });
    });

    test('Get notification ID', () => {
        const notificationId = pushNotificationManager.getNotificationId({
            owner,
            repo,
            pullRequestNumber,
            username,
            type,
        });
        assert.deepEqual(notificationId, notificationId);
    });
});
