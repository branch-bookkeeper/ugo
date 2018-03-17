/* globals test, suiteTeardown, suiteSetup, suite */
const request = require('supertest');
const { assert } = require('chai');
const sinon = require('sinon');
const mongoManager = require('../manager-mongo');
const GitHub = require('../github');
let server;
const url = '/webhook';
const owner = 'branch-bookkeeper';
const repo = 'branch-bookkeeper';
const branch = 'master';
const pullRequestNumber = 1;
const installationInfoFixture = require('./fixtures/installation.info.json');

const installationCreatedPayload = require('./fixtures/installation.created.json');
const installationDeletedPayload = require('./fixtures/installation.deleted.json');
const installationRepositoriesAddedPayload = require('./fixtures/installation_repositories.added.json');
const installationRepositoriesRemovedPayload = require('./fixtures/installation_repositories.removed.json');
const pullRequestOpenedPayload = require('./fixtures/pull_request.opened.json');
const pullRequestClosedPayload = require('./fixtures/pull_request.closed.json');
const pullRequestMergededPayload = require('./fixtures/pull_request.merged.json');
const statusFailurePayload = require('./fixtures/status.failure.json');
const statusSuccessPayload = require('./fixtures/status.success.json');
const pullRequestSynchronizePayload = require('./fixtures/pull_request.synchronize.json');
const repositoryCreatedPayload = require('./fixtures/repository.created.json');
const repositoryDeletedPayload = require('./fixtures/repository.deleted.json');

suite('Route webhook', () => {
    suiteSetup(function () {
        delete require.cache[require.resolve('../index')];
        server = require('../index');
        if (!mongoManager.enabled()) {
            this.skip();
        } else {
            sinon.stub(GitHub, 'getInstallationInfo').resolves(installationInfoFixture);
            sinon.stub(GitHub, 'updatePullRequestStatus').resolves({
                owner,
                repo,
                branch,
                pullRequestNumber,
            });
            return mongoManager.reset();
        }
    });

    setup(() => {
        return mongoManager.reset();
    });

    suiteTeardown(done => {
        server.close(done);
    });

    test('Add installation', (done) => {
        request(server)
            .post(url)
            .set('X-GitHub-Event', 'installation')
            .send(installationCreatedPayload)
            .expect(res => {
                assert.notEmpty(res.body);
                assert.isString(res.body);
                assert.include(res.body, 'created');
            })
            .expect(200, done);
    });

    test('Add repository', (done) => {
        request(server)
            .post(url)
            .set('X-GitHub-Event', 'installation_repositories')
            .send(installationRepositoriesAddedPayload)
            .expect(res => {
                assert.notEmpty(res.body);
                assert.isString(res.body);
                assert.include(res.body, 'added');
            })
            .expect(200, done);
    });

    test('Remove repository', (done) => {
        request(server)
            .post(url)
            .set('X-GitHub-Event', 'installation_repositories')
            .send(installationRepositoriesRemovedPayload)
            .expect(res => {
                assert.notEmpty(res.body);
                assert.isString(res.body);
                assert.include(res.body, 'removed');
            })
            .expect(200, done);
    });

    test('Create repository', (done) => {
        request(server)
            .post(url)
            .set('X-GitHub-Event', 'repository')
            .send(repositoryCreatedPayload)
            .expect(res => {
                assert.notEmpty(res.body);
                assert.isString(res.body);
                assert.include(res.body, 'deleted');
            })
            .expect(200, done);
    });

    test('Create PR', (done) => {
        request(server)
            .post(url)
            .set('X-GitHub-Event', 'pull_request')
            .send(pullRequestOpenedPayload)
            .expect(res => {
                assert.notEmpty(res.body);
                assert.isString(res.body);
                assert.include(res.body, 'opened');
            })
            .expect(200, done);
    });

    test('Close PR', (done) => {
        request(server)
            .post(url)
            .set('X-GitHub-Event', 'pull_request')
            .send(pullRequestClosedPayload)
            .expect(res => {
                assert.notEmpty(res.body);
                assert.isString(res.body);
                assert.include(res.body, 'closed');
            })
            .expect(200, done);
    });

    test('Sync PR', (done) => {
        request(server)
            .post(url)
            .set('X-GitHub-Event', 'pull_request')
            .send(pullRequestSynchronizePayload)
            .expect(res => {
                assert.notEmpty(res.body);
                assert.isString(res.body);
                assert.include(res.body, 'synchronize');
            })
            .expect(200, done);
    });

    test('Merge PR', (done) => {
        request(server)
            .post(url)
            .set('X-GitHub-Event', 'pull_request')
            .send(pullRequestMergededPayload)
            .expect(res => {
                assert.notEmpty(res.body);
                assert.isString(res.body);
                assert.include(res.body, 'closed');
            })
            .expect(200, done);
    });

    test('Status success', (done) => {
        request(server)
            .post(url)
            .set('X-GitHub-Event', 'status')
            .send(statusSuccessPayload)
            .expect(res => {
                assert.notEmpty(res.body);
                assert.isString(res.body);
                assert.include(res.body, 'success');
            })
            .expect(200, done);
    });

    test('Status failure', (done) => {
        request(server)
            .post(url)
            .set('X-GitHub-Event', 'status')
            .send(statusFailurePayload)
            .expect(res => {
                assert.notEmpty(res.body);
                assert.isString(res.body);
                assert.include(res.body, 'failure');
            })
            .expect(200, done);
    });

    test('Delete repository', (done) => {
        request(server)
            .post(url)
            .set('X-GitHub-Event', 'repository')
            .send(repositoryDeletedPayload)
            .expect(res => {
                assert.notEmpty(res.body);
                assert.isString(res.body);
                assert.include(res.body, 'deleted');
            })
            .expect(200, done);
    });

    test('Remove installation', (done) => {
        request(server)
            .post(url)
            .set('X-GitHub-Event', 'installation')
            .send(installationDeletedPayload)
            .expect(res => {
                assert.notEmpty(res.body);
                assert.include(res.body, 'deleted');
            })
            .expect(200, done);
    });
});
