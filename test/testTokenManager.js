/* globals test, setup, suiteSetup, suite */
const { assert } = require('chai');
const sinon = require('sinon');
const GitHub = require('../github');
const tokenManager = require('../manager-token');
const mongoManager = require('../manager-mongo');
const tokenInfoFixture = require('./fixtures/token.info');
let token = '';
let gitHubSpy;

sinon.assert.expose(assert, { prefix: '' });

suite('TokenManager', () => {
    setup(() => {
        gitHubSpy = sinon.stub(GitHub, 'getUserInfo').resolves(tokenInfoFixture);
    });

    teardown(() => {
        gitHubSpy.restore();
    });

    suiteSetup(() => {
        token = Math.random().toString(36).substring(2);
    });

    test('Set token info', () => {
        return tokenManager.setTokenInfo(token)
            .then(tokenInfo => assert.isUndefined(tokenInfo));
    });

    test('Get token info from GitHub', () => {
        return tokenManager.getTokenInfoFromGitHub(token)
            .then(tokenInfo => {
                assert.calledWith(gitHubSpy, token);
                assert.deepEqual(tokenInfo, tokenInfoFixture);
            });
    });

    test('Get token info', () => {
        return tokenManager.getTokenInfo(token)
            .then(tokenInfo => {
                mongoManager.enabled() ? assert.notCalled(gitHubSpy) : assert.calledWith(gitHubSpy, token);
                assert.deepEqual(tokenInfo, tokenInfoFixture);
            });
    });
});
