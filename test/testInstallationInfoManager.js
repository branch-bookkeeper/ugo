/* globals test, setup, suiteSetup, suite */
const { assert } = require('chai');
const sinon = require('sinon');
const installationInfoManager = require('../manager-installation-info');
const mongoManager = require('../manager-mongo');
const GitHub = require('../github');
const postal = require('postal');
const installationInfoFixture = require('./fixtures/installation.info.json');
let gitHubSpy;
let postalSpy;
let token = '';
let randomId = 0;

sinon.assert.expose(assert, { prefix: '' });

suite('InstallationInfoManager', () => {
    suiteSetup(function () {
        randomId = Math.floor(Math.random() * 1089) + 1000;
        token = Math.random().toString(36).substring(2);
        return mongoManager.enabled() && mongoManager.reset();
    });

    setup(() => {
        postalSpy = sinon.stub(postal, 'publish');
        gitHubSpy = sinon.stub(GitHub, 'getInstallationInfo').resolves(installationInfoFixture);
    });

    teardown(() => {
        postalSpy.restore();
        gitHubSpy.restore();
    });

    test('Get installation info', () => {
        return installationInfoManager.getInstallationInfo(token, randomId)
            .then(installationInfo => {
                assert.calledWith(gitHubSpy, token, randomId);
                mongoManager.enabled() && assert.calledWith(postalSpy, {
                    channel: 'installation',
                    data: {
                        installationId: randomId,
                        installationInfo: installationInfoFixture,
                        token,
                    },
                    topic: 'info.set',
                });
                assert.deepEqual(installationInfo, installationInfoFixture);
            });
    });

    test('Get existing installation info', () => {
        return installationInfoManager.getInstallationInfo(token, randomId)
            .then(installationInfo => {
                mongoManager.enabled() ? assert.notCalled(gitHubSpy) : assert.calledWith(gitHubSpy, token, randomId);
                assert.notCalled(postalSpy);
                assert.deepEqual(installationInfo, installationInfoFixture);
            });
    });

    test('Remove installation info', () => {
        return installationInfoManager.deleteInstallationInfos(randomId)
            .then(() => {
                mongoManager.enabled() && assert.calledWith(postalSpy, {
                    channel: 'installation',
                    data: {
                        installationId: randomId,
                    },
                    topic: 'info.delete',
                });
            });
    });
});
