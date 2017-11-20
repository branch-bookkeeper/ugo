/* globals test, setup, suiteSetup, suite */
const { assert } = require('chai');
const installationManager = require('../manager-installation');
const mongoManager = require('../manager-mongo');
const owner = 'branch-bookkeeper';
let randomId = 0;

suite('InstallationManager', () => {
    suiteSetup(function () {
        if (!mongoManager.enabled()) {
            return this.skip();
        }
        randomId = Math.floor(Math.random() * 89) + 10;
        return mongoManager.reset();
    });

    test('Set installation id', () => {
        return installationManager.setInstallationId(owner, randomId);
    });

    test('Get installation id', () => {
        return installationManager.getInstallationId(owner)
            .then(installationId => {
                assert.deepEqual(installationId, randomId);
            });
    });

    test('Remove installation id', () => {
        return installationManager.deleteInstallationId(owner);
    });

    test('Get not existing installation id', () => {
        return installationManager.getInstallationId(owner)
            .then(installationId => {
                assert.isUndefined(installationId);
            });
    });
});
