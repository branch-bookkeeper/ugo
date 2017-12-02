/* globals test, suiteTeardown, suiteSetup, suite */
const request = require('supertest');
const { assert } = require('chai');
const sinon = require('sinon');
const pullRequestManager = require('../manager-pullrequest');
const pullRequestInfoFixture = require('./fixtures/pull_request.info.json');
const owner = 'branch-bookkeeper';
const repo = 'branch-bookkeeper';
const url = '/pull-request';
let server;
let pullRequestManagerPullRequestInfoSpy;
let pullRequestManagerRepositoryPullRequestInfoSpy;
let randomNumber = 0;

suite('Route pull-request', () => {
    suiteSetup(function () {
        delete require.cache[require.resolve('../index')];
        server = require('../index');
        randomNumber = Math.floor(Math.random() * 89) + 10;

        pullRequestManagerPullRequestInfoSpy = sinon.stub(pullRequestManager, 'getPullRequestInfo');
        pullRequestManagerPullRequestInfoSpy.withArgs(owner, repo, randomNumber.toString()).resolves(pullRequestInfoFixture);
        pullRequestManagerPullRequestInfoSpy.callThrough();

        pullRequestManagerRepositoryPullRequestInfoSpy = sinon.stub(pullRequestManager, 'getRepositoryPullRequestsInfo');
        pullRequestManagerRepositoryPullRequestInfoSpy.withArgs(owner, repo).resolves([pullRequestInfoFixture]);
        pullRequestManagerRepositoryPullRequestInfoSpy.callThrough();

        if (!pullRequestManager.enabled()) {
            this.skip();
        }
    });

    suiteTeardown(done => {
        server.close(done);
        pullRequestManagerPullRequestInfoSpy.restore();
        pullRequestManagerRepositoryPullRequestInfoSpy.restore();
    });

    test('Get all PR of a repository', done => {
        request(server)
            .get(`${url}/${owner}/${repo}`)
            .expect('content-type', /application\/json/)
            .expect('content-length', '310')
            .expect([pullRequestInfoFixture])
            .expect(200, done);
    });

    test('Get all PR of a not existing repository', done => {
        request(server)
            .get(`${url}/${owner}/${repo}-fake`)
            .expect('content-type', /application\/json/)
            .expect('content-length', '21')
            .expect({ error: 'Not Found' })
            .expect(404, done);
    });
});
