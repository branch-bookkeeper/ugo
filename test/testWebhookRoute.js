/* globals test, suiteTeardown, suiteSetup, suite */
const request = require('supertest');
const { assert } = require('chai');
const sinon = require('sinon');
const mongoManager = require('../manager-mongo');
const GitHub = require('../github');
let server;
const url = '/webhook';
const installationInfoFixture = require('./fixtures/installation.info.json');

const installationCreatedPayload = require('./fixtures/installation.created.json');
const installationDeletedPayload = require('./fixtures/installation.deleted.json');
const installationRepositoriesAddedPayload = require('./fixtures/installation_repositories.added.json');
const installationRepositoriesRemovedPayload = require('./fixtures/installation_repositories.removed.json');
const pullRequestOpenedPayload = require('./fixtures/pull_request.opened.json');
const pullRequestClosedPayload = require('./fixtures/pull_request.closed.json');
const pullRequestMergededPayload = require('./fixtures/pull_request.merged.json');
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
            sinon.stub(GitHub, 'updatePullRequestStatus');
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
                assert.isObject(res.body);
                assert.include(res.body, { status: 'failure' });
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
                assert.isObject(res.body);
                assert.include(res.body, { status: 'failure' });
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