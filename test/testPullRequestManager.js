/* globals test, setup, suiteSetup, suite */
const { assert } = require('chai');
const pullRequestManager = require('../manager-pullrequest');
const mongoManager = require('../manager-mongo');
const pullRequestInfoFixture = require('./fixtures/pull_request.info.json');
const owner = 'branch-bookkeeper';
const repo = 'branch-bookkeeper';
let randomNumber = 0;

suite('PullRequestManager', () => {
    suiteSetup(function () {
        if (!pullRequestManager.enabled()) {
            this.skip();
        }
        randomNumber = Math.floor(Math.random() * 89) + 10;
        return mongoManager.reset();
    });

    test('Set info', () => {
        return pullRequestManager.setPullRequestInfo(owner, repo, randomNumber, pullRequestInfoFixture)
            .then(items => {
                assert.deepEqual(items, pullRequestInfoFixture);
            });
    });

    test('Get pull request info', () => {
        return pullRequestManager.getPullRequestInfo(owner, repo, randomNumber)
            .then(items => {
                assert.deepEqual(items, pullRequestInfoFixture);
            });
    });

    test('Get repository info', () => {
        return pullRequestManager.getRepositoryPullRequestsInfo(owner, repo)
            .then(items => {
                assert.isArray(items);
                assert.deepEqual(items, [pullRequestInfoFixture]);
            });
    });

    test('Remove pull request info', () => {
        return pullRequestManager.deletePullRequestInfo(owner, repo, randomNumber, pullRequestInfoFixture)
            .then(items => {
                assert.isUndefined(items);
            });
    });

    test('Remove owner info', () => {
        return pullRequestManager.deletePullRequestInfos(owner)
            .then(items => {
                assert.isUndefined(items);
            });
    });
});
