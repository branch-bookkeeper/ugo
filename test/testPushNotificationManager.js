/* globals test, setup, suiteSetup, suite */
const { assert } = require('chai');
const sinon = require('sinon');
const oneSignalNode = require('onesignal-node');
const postal = require('postal');
const mongoManager = require('../manager-mongo');
const pushNotificationManager = require('../manager-notification-push');
const GitHub = require('../github');
const fakeOneSignalSendReponse = { id: 'fake', recipients: 3 };
const fakeOneSignalCancelReponse = { success: 'true' };
let owner;
let repo;
let username;
let options;
let pullRequestNumber;
let oneSignalSendSpy;
let oneSignalCancelSpy;
let postalSpy;

sinon.assert.expose(assert, { prefix: '' });

suite('PushNotificationManager', () => {
    setup(() => {
        oneSignalSendSpy = sinon
            .stub(oneSignalNode.Client.prototype, 'sendNotification')
            .resolves({ data: fakeOneSignalSendReponse });

        oneSignalCancelSpy = sinon
            .stub(oneSignalNode.Client.prototype, 'cancelNotification')
            .resolves({ data: JSON.stringify(fakeOneSignalSendReponse) });

        postalSpy = sinon.stub(postal, 'publish');
        pullRequestNumber = Math.floor(Math.random() * 89) + 10;
        owner = Math.random().toString(36).substring(2);
        repo = Math.random().toString(36).substring(2);
        username = Math.random().toString(36).substring(2);

        options = {
            owner,
            repo,
            username,
            pullRequestNumber,
        };
    });

    teardown(() => {
        oneSignalSendSpy.restore();
        oneSignalCancelSpy.restore();
        postalSpy.restore();
    });

    test('Send first in queue notification', () => {
        const message = `${owner}/${repo} #${pullRequestNumber} is first in the queue`;
        return pushNotificationManager.sendFirstInQueueNotification(options)
            .then(data => {
                const { args: [{ postBody }] } = oneSignalSendSpy.firstCall;
                assert.deepEqual(postBody, {
                    contents: { en: message },
                    filters: [{
                        field: 'tag', key: 'username', relation: '=', value: username,
                    }],
                    headings: { en: pushNotificationManager.TITLE_FIRST },
                    url: `https://github.com/${owner}/${repo}/pull/${pullRequestNumber}`,
                });
                assert.deepEqual(data, fakeOneSignalSendReponse);
                assert.deepEqual(postalSpy.firstCall.lastArg, {
                    channel: 'notification',
                    data: fakeOneSignalSendReponse,
                    topic: 'sent.ok',
                });
                assert.notCalled(oneSignalCancelSpy);
            });
    });

    test('Send success notification', () => {
        options = {
            ...options,
            state: GitHub.STATUS_SUCCESS,
        };
        const message = `${owner}/${repo} #${pullRequestNumber} passed its checks`;
        return pushNotificationManager.sendChecksNotification(options)
            .then(data => {
                const { args: [{ postBody }] } = oneSignalSendSpy.firstCall;
                assert.match(postBody, {
                    contents: { en: message },
                    filters: [{
                        field: 'tag', key: 'username', relation: '=', value: username,
                    }],
                    headings: { en: pushNotificationManager.TITLE_CHECKS_PASSED },
                    url: `https://github.com/${owner}/${repo}/pull/${pullRequestNumber}`,
                });
                assert.containsAllKeys(postBody, ['send_after']);
                assert.include(postBody.send_after, new Date().toISOString().substring(0, 14));
                assert.match(data, {
                    ...fakeOneSignalSendReponse,
                    message,
                    owner,
                    repo,
                    pullRequestNumber,
                    title: pushNotificationManager.TITLE_CHECKS_PASSED,
                    username,
                    type: pushNotificationManager.NOTIFICATION_TYPE_CHECKS,
                });
                assert.include(data.sendAt.toISOString(), new Date().toISOString().substring(0, 14));
                assert.notCalled(oneSignalCancelSpy);
                assert.isTrue(oneSignalSendSpy.calledBefore(postalSpy));
                assert.calledWith(postalSpy, {
                    channel: 'notification',
                    data: fakeOneSignalSendReponse,
                    topic: 'sent.ok',
                });
            });
    });

    test('Send failure notification', () => {
        options = {
            ...options,
            state: GitHub.STATUS_FAILURE,
        };
        const message = `${owner}/${repo} #${pullRequestNumber} failed its checks`;
        return pushNotificationManager.sendChecksNotification(options)
            .then(data => {
                const { args: [{ postBody }] } = oneSignalSendSpy.firstCall;
                assert.match(postBody, {
                    contents: { en: message },
                    filters: [{
                        field: 'tag', key: 'username', relation: '=', value: username,
                    }],
                    headings: { en: pushNotificationManager.TITLE_CHECKS_FAILED },
                    url: `https://github.com/${owner}/${repo}/pull/${pullRequestNumber}`,
                });
                assert.containsAllKeys(postBody, ['send_after']);
                assert.include(postBody.send_after, new Date().toISOString().substring(0, 14));
                assert.match(data, {
                    ...fakeOneSignalSendReponse,
                    message,
                    owner,
                    repo,
                    pullRequestNumber,
                    title: pushNotificationManager.TITLE_CHECKS_FAILED,
                    username,
                    type: pushNotificationManager.NOTIFICATION_TYPE_CHECKS,
                });
                assert.include(data.sendAt.toISOString(), new Date().toISOString().substring(0, 14));
                assert.notCalled(oneSignalCancelSpy);
                assert.isTrue(oneSignalSendSpy.calledBefore(postalSpy));
                assert.calledWith(postalSpy, {
                    channel: 'notification',
                    data: fakeOneSignalSendReponse,
                    topic: 'sent.ok',
                });
            });
    });

    test('Cancel notification', () => {
        options = {
            ...options,
            state: GitHub.STATUS_PENDING,
        };
        const message = `${owner}/${repo} #${pullRequestNumber} failed its checks`;
        return pushNotificationManager.sendChecksNotification(options)
            .then(() => pushNotificationManager.cancelChecksNotification(options))
            .then(data => {
                assert.equal(oneSignalCancelSpy.called, mongoManager.enabled());
                if (mongoManager.enabled()) {
                    assert.notEmpty(data);
                    assert.equal(oneSignalCancelSpy.firstCall.lastArg, fakeOneSignalSendReponse.id);
                }
                const { postBody } = oneSignalSendSpy.firstCall.lastArg;
                assert.match(postBody, {
                    contents: { en: message },
                    filters: [{
                        field: 'tag', key: 'username', relation: '=', value: username,
                    }],
                    headings: { en: pushNotificationManager.TITLE_CHECKS_FAILED },
                    url: `https://github.com/${owner}/${repo}/pull/${pullRequestNumber}`,
                });
                assert.containsAllKeys(postBody, ['send_after']);
                assert.include(postBody.send_after, new Date().toISOString().substring(0, 14));
                assert.isTrue(oneSignalSendSpy.calledBefore(postalSpy));
                // First send cancels any previous notification
                assert.match(postalSpy.firstCall.lastArg, {
                    channel: 'notification',
                    topic: 'cancel.ko',
                });
                // First send
                assert.deepEqual(postalSpy.secondCall.lastArg, {
                    channel: 'notification',
                    data: fakeOneSignalSendReponse,
                    topic: 'sent.ok',
                });
                // Cancel
                assert.match(postalSpy.thirdCall.lastArg, {
                    channel: 'notification',
                    topic: mongoManager.enabled() ? 'cancel.ok' : 'cancel.ko',
                });
            });
    });

    test('Cancel duplicate notifications', () => {
        options = {
            ...options,
            state: GitHub.STATUS_FAILURE,
        };
        const message = `${owner}/${repo} #${pullRequestNumber} failed its checks`;
        return pushNotificationManager.sendChecksNotification(options)
            .then(() => pushNotificationManager.sendChecksNotification(options))
            .then(data => {
                oneSignalSendSpy.getCalls().forEach(({ args: [{ postBody }] }) => {
                    assert.match(postBody, {
                        contents: { en: message },
                        filters: [{
                            field: 'tag', key: 'username', relation: '=', value: username,
                        }],
                        headings: { en: pushNotificationManager.TITLE_CHECKS_FAILED },
                        url: `https://github.com/${owner}/${repo}/pull/${pullRequestNumber}`,
                    });
                    assert.containsAllKeys(postBody, ['send_after']);
                    assert.include(postBody.send_after, new Date().toISOString().substring(0, 14));
                });
                assert.equal(oneSignalCancelSpy.called, mongoManager.enabled());
                if (mongoManager.enabled()) {
                    assert.calledWith(oneSignalCancelSpy, fakeOneSignalSendReponse.id);
                }
                assert.match(data, {
                    ...fakeOneSignalSendReponse,
                    message,
                    owner,
                    repo,
                    pullRequestNumber,
                    title: pushNotificationManager.TITLE_CHECKS_FAILED,
                    username,
                    type: pushNotificationManager.NOTIFICATION_TYPE_CHECKS,
                });
                assert.include(data.sendAt.toISOString(), new Date().toISOString().substring(0, 14));
                assert.isTrue(oneSignalSendSpy.calledBefore(postalSpy));
                assert.calledWith(postalSpy, {
                    channel: 'notification',
                    data: fakeOneSignalSendReponse,
                    topic: 'sent.ok',
                });
                // First send cancels any previous notification
                assert.match(postalSpy.firstCall.lastArg, {
                    channel: 'notification',
                    topic: 'cancel.ko',
                });
                // First send
                assert.deepEqual(postalSpy.secondCall.lastArg, {
                    channel: 'notification',
                    data: fakeOneSignalSendReponse,
                    topic: 'sent.ok',
                });
                // Cancel
                assert.match(postalSpy.thirdCall.lastArg, {
                    channel: 'notification',
                    topic: mongoManager.enabled() ? 'cancel.ok' : 'cancel.ko',
                });
                // Second send
                assert.deepEqual(postalSpy.lastCall.lastArg, {
                    channel: 'notification',
                    data: fakeOneSignalSendReponse,
                    topic: 'sent.ok',
                });
            });
    });
});
