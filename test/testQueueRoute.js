/* globals test, suiteTeardown, suiteSetup, suite */
const request = require('supertest');
const { assert } = require('chai');
const { pathOr } = require('ramda');
const sinon = require('sinon');
const mongoManager = require('../manager-mongo');
const tokenManager = require('../manager-token');
const installationInfoManager = require('../manager-installation-info');
const installationManager = require('../manager-installation');
let server;
let tokenManagerSpy;
let installationInfoManagerSpy;
let installationManagerSpy;
const randomNumber = Math.floor(Math.random() * 89) + 10;
const owner = 'branch-bookkeeper';
const repo = 'branch-bookkeeper';
const branch = 'master';
const url = `/queue/${owner}/${repo}/${branch}`;
const queueItemFixture = require('./fixtures/queue.item');
const tokenInfoFixture = { client_id: process.env.CLIENT_ID, login: queueItemFixture.username };
const adminToken = 'iamanadmin';
const userToken = 'iamanuser';
const limitedToken = 'iamalimiteduser';
const otherUserToken = 'iamanotheruser';

sinon.assert.expose(assert, { prefix: '' });

suite('Route queue', () => {
    suiteSetup(function () {
        delete require.cache[require.resolve('../index')];
        server = require('../index');

        tokenManagerSpy = sinon.stub(tokenManager, 'getTokenInfo')
            .resolves(tokenInfoFixture);

        installationInfoManagerSpy = sinon.stub(installationInfoManager, 'getInstallationInfo');
        installationInfoManagerSpy.withArgs(userToken)
            .resolves({ repositories: [{ full_name: `${owner}/${repo}`, permissions: { admin: false, push: true, pull: true } }] });
        installationInfoManagerSpy.withArgs(adminToken)
            .resolves({ repositories: [{ full_name: `${owner}/${repo}`, permissions: { admin: true, push: true, pull: true } }] });
        installationInfoManagerSpy.withArgs(limitedToken)
            .resolves({ repositories: [{ full_name: `${owner}/${repo}`, permissions: { admin: false, push: false, pull: true } }] });
        installationInfoManagerSpy.withArgs(otherUserToken)
            .resolves({ repositories: [{ full_name: `${owner}/${repo}-other` }] });

        installationManagerSpy = sinon.stub(installationManager, 'getInstallationId')
            .resolves(1234);

        if (!mongoManager.enabled()) {
            this.skip();
        } else {
            return mongoManager.reset();
        }
    });

    suiteTeardown(done => {
        server.close(done);
        tokenManagerSpy.restore();
        installationInfoManagerSpy.restore();
        installationManagerSpy.restore();
    });

    test('Get list without authorization', done => {
        request(server)
            .get(url)
            .expect('content-type', /application\/json/)
            .expect('content-length', '24')
            .expect({ error: 'Unauthorized' })
            .expect(401, done);
    });

    test('Get list with other repo authorization', done => {
        request(server)
            .get(url)
            .set('Authorization', `token ${otherUserToken}`)
            .expect('content-type', /application\/json/)
            .expect('content-length', '24')
            .expect({ error: 'Unauthorized' })
            .expect(401, done);
    });

    test('Get list with insufficent authorization', done => {
        request(server)
            .get(url)
            .set('Authorization', `token ${limitedToken}`)
            .expect('content-type', /application\/json/)
            .expect('content-length', '24')
            .expect({ error: 'Unauthorized' })
            .expect(401, done);
    });

    test('Get empty list', done => {
        request(server)
            .get(url)
            .set('Authorization', `token ${userToken}`)
            .expect('content-type', /application\/json/)
            .expect('content-length', '2')
            .expect([])
            .expect(200, done);
    });

    [0, 1, 2].forEach(i => {
        test(`Add item ${i}`, done => {
            request(server)
                .post(url)
                .set('Authorization', `token ${userToken}`)
                .send({
                    ...queueItemFixture,
                    pullRequestNumber: randomNumber + i,
                })
                .expect('content-type', /application\/json/)
                .expect(res => assert.empty(res.body))
                .expect(201, done);
        });
    });

    test('Get list with three items', done => {
        request(server)
            .get(url)
            .set('Authorization', `token ${userToken}`)
            .expect('content-type', /application\/json/)
            .expect('content-length', '286')
            .expect(res => [0, 1, 2].forEach(i => assert.deepEqual(pathOr(0, ['body', i, 'pullRequestNumber'], res), randomNumber + i)))
            .expect(200, done);
    });
    /*
    test('Add malformed item', done => {
        request(server)
            .post(url)
            .set('Authorization', `token ${userToken}`)
            .send({
                pullRequestNumber: 1,
            })
            .expect('content-type', /application\/json/)
            .expect({ error: 'Malformed request body' })
            .expect(201, done);
    });
    */
    test('Add empty item', done => {
        request(server)
            .post(url)
            .set('Authorization', `token ${userToken}`)
            .send({})
            .expect('content-type', /application\/json/)
            .expect({ error: 'Malformed request body' })
            .expect(400, done);
    });

    test('Add item without authorization', done => {
        request(server)
            .post(url)
            .send(queueItemFixture)
            .expect('content-type', /application\/json/)
            .expect({ error: 'Unauthorized' })
            .expect(401, done);
    });

    test('Add item with other repo authorization', done => {
        request(server)
            .post(url)
            .set('Authorization', `token ${otherUserToken}`)
            .send(queueItemFixture)
            .expect('content-type', /application\/json/)
            .expect({ error: 'Unauthorized' })
            .expect(401, done);
    });

    test('Add item for other user', done => {
        request(server)
            .post(url)
            .set('Authorization', `token ${userToken}`)
            .send({
                ...queueItemFixture,
                username: 'otherUser',
            })
            .expect('content-type', /application\/json/)
            .expect({ error: 'Unauthorized' })
            .expect(401, done);
    });

    test('Add item for other user with admin authorization', done => {
        request(server)
            .post(url)
            .set('Authorization', `token ${adminToken}`)
            .send({
                ...queueItemFixture,
                username: 'otherUser',
            })
            .expect('content-type', /application\/json/)
            .expect(res => assert.empty(res.body))
            .expect(201, done);
    });

    test('Add item with insufficent authorization', done => {
        request(server)
            .post(url)
            .set('Authorization', `token ${limitedToken}`)
            .send(queueItemFixture)
            .expect('content-type', /application\/json/)
            .expect({ error: 'Unauthorized' })
            .expect(401, done);
    });
    /*
    test('Remove malformed item', done => {
        request(server)
            .delete(url)
            .set('Authorization', `token ${userToken}`)
            .send({
                pullRequestNumber: 1,
            })
            .expect('content-type', /application\/json/)
            .expect({ error: 'Malformed request body' })
            .expect(201, done);
    });
    */
    test('Remove empty item', done => {
        request(server)
            .delete(url)
            .set('Authorization', `token ${userToken}`)
            .send({})
            .expect('content-type', /application\/json/)
            .expect({ error: 'Malformed request body' })
            .expect(400, done);
    });

    test('Remove item without authorization', done => {
        request(server)
            .delete(url)
            .send(queueItemFixture)
            .expect('content-type', /application\/json/)
            .expect({ error: 'Unauthorized' })
            .expect(401, done);
    });

    test('Remove item with other authorization', done => {
        request(server)
            .delete(url)
            .set('Authorization', `token ${otherUserToken}`)
            .send(queueItemFixture)
            .expect('content-type', /application\/json/)
            .expect({ error: 'Unauthorized' })
            .expect(401, done);
    });

    test('Remove item for other user', done => {
        request(server)
            .delete(url)
            .set('Authorization', `token ${userToken}`)
            .send({
                ...queueItemFixture,
                username: 'otherUser',
            })
            .expect('content-type', /application\/json/)
            .expect({ error: 'Unauthorized' })
            .expect(401, done);
    });

    test('Remove item for other user with admin authorization', done => {
        request(server)
            .delete(url)
            .set('Authorization', `token ${adminToken}`)
            .send({
                ...queueItemFixture,
                username: 'otherUser',
            })
            .expect(res => assert.empty(res.body))
            .expect(204, done);
    });

    test('Remove item with insufficent authorization', done => {
        request(server)
            .delete(url)
            .set('Authorization', `token ${limitedToken}`)
            .send(queueItemFixture)
            .expect('content-type', /application\/json/)
            .expect({ error: 'Unauthorized' })
            .expect(401, done);
    });

    test('Remove second item', done => {
        request(server)
            .delete(url)
            .set('Authorization', `token ${userToken}`)
            .send({
                ...queueItemFixture,
                pullRequestNumber: randomNumber + 1,
            })
            .expect(res => assert.empty(res.body))
            .expect(204, done);
    });

    test('Get list with first and third item', done => {
        request(server)
            .get(url)
            .set('Authorization', `token ${userToken}`)
            .expect('content-type', /application\/json/)
            .expect('content-length', '191')
            .expect(res => {
                assert.deepEqual(pathOr(0, ['body', 0, 'pullRequestNumber'], res), randomNumber);
                assert.deepEqual(pathOr(0, ['body', 1, 'pullRequestNumber'], res), randomNumber + 2);
            })
            .expect(200, done);
    });

    test('Remove first item', done => {
        request(server)
            .delete(url)
            .set('Authorization', `token ${userToken}`)
            .send({
                ...queueItemFixture,
                pullRequestNumber: randomNumber,
            })
            .expect(res => assert.empty(res.body))
            .expect(204, done);
    });

    test('Get list with third item', done => {
        request(server)
            .get(url)
            .set('Authorization', `token ${userToken}`)
            .expect('content-type', /application\/json/)
            .expect('content-length', '96')
            .expect(res => assert.deepEqual(pathOr(0, ['body', 0, 'pullRequestNumber'], res), randomNumber + 2))
            .expect(200, done);
    });

    test('Remove third item', done => {
        request(server)
            .delete(url)
            .set('Authorization', `token ${userToken}`)
            .send({
                ...queueItemFixture,
                pullRequestNumber: randomNumber + 2,
            })
            .expect(res => assert.empty(res.body))
            .expect(204, done);
    });

    test('Get empty list', done => {
        request(server)
            .get(url)
            .set('Authorization', `token ${userToken}`)
            .expect('content-type', /application\/json/)
            .expect('content-length', '2')
            .expect([])
            .expect(200, done);
    });
});
