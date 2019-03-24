/* globals test, suiteTeardown, suiteSetup, suite */
const request = require('supertest');
const sinon = require('sinon');
const pullRequestManager = require('../manager-pullrequest');
const tokenManager = require('../manager-token');
const installationInfoManager = require('../manager-installation-info');
const installationManager = require('../manager-installation');
const pullRequestInfoFixture = require('./fixtures/pull_request.info');
const owner = 'branch-bookkeeper';
const repo = 'branch-bookkeeper';
const url = '/pull-request';
const tokenInfoFixture = { client_id: process.env.CLIENT_ID, login: 'branch-bookkeeper' };
const userToken = 'iamanuser';
let server;
let pullRequestManagerPullRequestInfoSpy;
let pullRequestManagerRepositoryPullRequestInfoSpy;
let tokenManagerSpy;
let installationInfoManagerSpy;
let installationManagerSpy;
let randomNumber = 0;

suite('Route pull-request', () => {
    suiteSetup(function () {
        delete require.cache[require.resolve('../index')];
        server = require('../index');
        randomNumber = Math.floor(Math.random() * 89) + 10;

        pullRequestManagerPullRequestInfoSpy = sinon.stub(pullRequestManager, 'getPullRequestInfo');
        pullRequestManagerPullRequestInfoSpy.withArgs(owner, repo, randomNumber.toString()).resolves(pullRequestInfoFixture);

        pullRequestManagerRepositoryPullRequestInfoSpy = sinon.stub(pullRequestManager, 'getRepositoryPullRequestsInfo');
        pullRequestManagerRepositoryPullRequestInfoSpy.withArgs(owner, repo).resolves([pullRequestInfoFixture]);

        tokenManagerSpy = sinon.stub(tokenManager, 'getTokenInfo')
            .resolves(tokenInfoFixture);

        installationInfoManagerSpy = sinon.stub(installationInfoManager, 'getInstallationInfo')
            .resolves({
                repositories: [
                    { full_name: `${owner}/${repo}`, permissions: { pull: true, push: true } },
                    { full_name: `${owner}/${repo}-other`, permissions: {} },
                ],
            });

        installationManagerSpy = sinon.stub(installationManager, 'getInstallationId')
            .resolves(1234);

        if (!pullRequestManager.enabled()) {
            this.skip();
        }
    });

    suiteTeardown(done => {
        server.close(done);
        pullRequestManagerPullRequestInfoSpy.restore();
        pullRequestManagerRepositoryPullRequestInfoSpy.restore();
        tokenManagerSpy.restore();
        installationInfoManagerSpy.restore();
        installationManagerSpy.restore();
    });

    test('Get all PR of a repository', done => {
        request(server)
            .get(`${url}/${owner}/${repo}`)
            .set('Authorization', `token ${userToken}`)
            .expect('content-type', /application\/json/)
            .expect('content-length', '244')
            .expect([pullRequestInfoFixture])
            .expect(200, done);
    });

    test('Get all PR of a repository not accessible', done => {
        request(server)
            .get(`${url}/${owner}/${repo}-other`)
            .set('Authorization', `token ${userToken}`)
            .expect('content-type', /application\/json/)
            .expect('content-length', '24')
            .expect({ error: 'Unauthorized' })
            .expect(401, done);
    });

    test('Get all PR of a not existing repository', done => {
        request(server)
            .get(`${url}/${owner}/${repo}-fake`)
            .set('Authorization', `token ${userToken}`)
            .expect('content-type', /application\/json/)
            .expect('content-length', '24')
            .expect({ error: 'Unauthorized' })
            .expect(401, done);
    });
});
