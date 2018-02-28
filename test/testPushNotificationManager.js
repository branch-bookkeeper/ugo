/* globals test, setup, suiteSetup, suite */
const { assert } = require('chai');
const sinon = require('sinon');
const oneSignal = require('simple-onesignal');
const pushNotificationManager = require('../manager-notification-push');
const fakeOneSignalReponse = { fake: true };
let owner;
let repo;
let username;
let branch;
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
        branch = Math.random().toString(36).substring(2);
        username = Math.random().toString(36).substring(2);

        options = {
            owner,
            repo,
            branch,
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

    test('Send merged notification', () => {
        return pushNotificationManager.sendMergedNotification(options)
            .then(data => {
                assert.calledWith(oneSignalSpy, {
                    contents: { en: `${owner}/${repo} #${pullRequestNumber} can be merged on ${branch}` },
                    filters: [{
                        field: 'tag', key: 'username', relation: '=', value: username,
                    }],
                    headings: { en: 'All checks passed' },
                    url: `https://github.com/${owner}/${repo}/pull/${pullRequestNumber}`,
                });
                assert.deepEqual(data, fakeOneSignalReponse);
            });
    });
});
