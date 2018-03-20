/* globals test, setup, suiteSetup, suite */
const { assert } = require('chai');
const sinon = require('sinon');
const oneSignal = require('simple-onesignal');
const pushNotificationManager = require('../manager-notification-push');
const GitHub = require('../github');
const fakeOneSignalReponse = { fake: true };
let owner;
let repo;
let username;
let options;
let pullRequestNumber;
let oneSignalSpy;

sinon.assert.expose(assert, { prefix: '' });

suite('PushNotificationManager', () => {
    setup(() => {
        oneSignalSpy = sinon.stub(oneSignal, 'sendMessage').callsFake((opt, callback) => callback(null, fakeOneSignalReponse));
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
        oneSignalSpy.restore();
    });

    test('Send rebased notification', () => {
        return pushNotificationManager.sendRebasedNotification(options)
            .then(data => {
                assert.calledWith(oneSignalSpy, {
                    contents: { en: `${owner}/${repo} #${pullRequestNumber} can be rebased from ${branch}` },
                    filters: [{
                        field: 'tag', key: 'username', relation: '=', value: username,
                    }],
                    headings: { en: 'Your PR can be rebased' },
                    url: `https://github.com/${owner}/${repo}/pull/${pullRequestNumber}`,
                });
                assert.deepEqual(data, fakeOneSignalReponse);
            });
    });

    test('Send success notification', () => {
        options = {
            ...options,
            state: GitHub.STATUS_SUCCESS,
        };
        return pushNotificationManager.sendChecksNotification(options)
            .then(data => {
                assert.calledWith(oneSignalSpy, {
                    contents: { en: `${owner}/${repo} #${pullRequestNumber} can be merged into ${branch}` },
                    filters: [{
                        field: 'tag', key: 'username', relation: '=', value: username,
                    }],
                    headings: { en: 'All checks have passed' },
                    url: `https://github.com/${owner}/${repo}/pull/${pullRequestNumber}`,
                });
                assert.deepEqual(data, fakeOneSignalReponse);
            });
    });

    test('Send failure notification', () => {
        options = {
            ...options,
            state: GitHub.STATUS_FAILURE,
        };
        return pushNotificationManager.sendChecksNotification(options)
            .then(data => {
                assert.calledWith(oneSignalSpy, {
                    contents: { en: `${owner}/${repo} #${pullRequestNumber} failed its checks` },
                    filters: [{
                        field: 'tag', key: 'username', relation: '=', value: username,
                    }],
                    headings: { en: 'Some checks were not successful' },
                    url: `https://github.com/${owner}/${repo}/pull/${pullRequestNumber}`,
                });
                assert.deepEqual(data, fakeOneSignalReponse);
            });
    });
});
