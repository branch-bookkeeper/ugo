/* globals test, suiteTeardown, suiteSetup, suite */
const request = require('supertest');
const { assert } = require('chai');
const { pathOr } = require('ramda');
const mongoManager = require('../manager-mongo');
let server;
const randomNumber = Math.floor(Math.random() * 89) + 10;
const queueItemFixture = require('./fixtures/queue.item.json');
const url = '/queue/branch-bookkeeper/branch-bookkeeper/master';

suite('Route queue', () => {
    suiteSetup(function () {
        delete require.cache[require.resolve('../index')];
        server = require('../index');
        if (!mongoManager.enabled()) {
            this.skip();
        } else {
            return mongoManager.reset();
        }
    });

    suiteTeardown(done => {
        server.close(done);
    });

    test('Get empty list', done => {
        request(server)
            .get(url)
            .expect('content-type', /application\/json/)
            .expect('content-length', '2')
            .expect([])
            .expect(200, done);
    });

    [0, 1, 2].forEach(i => {
        test(`Add item ${i}`, done => {
            request(server)
                .post(url)
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
            .expect('content-type', /application\/json/)
            .expect('content-length', '286')
            .expect(res =>
                [0, 1, 2].forEach(i => assert.deepEqual(pathOr(0, ['body', i, 'pullRequestNumber'], res), randomNumber + i)))
            .expect(200, done);
    });

    test('Remove second item', done => {
        request(server)
            .delete(url)
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
            .send({
                ...queueItemFixture,
                pullRequestNumber: randomNumber,
            })
            .expect(res => {
                assert.empty(res.body);
            })
            .expect(204, done);
    });

    test('Get list with item three', done => {
        request(server)
            .get(url)
            .expect('content-type', /application\/json/)
            .expect('content-length', '96')
            .expect(res => {
                assert.deepEqual(pathOr(0, ['body', 0, 'pullRequestNumber'], res), randomNumber + 2);
            })
            .expect(200, done);
    });

    test('Remove third item', done => {
        request(server)
            .delete(url)
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
            .expect('content-type', /application\/json/)
            .expect('content-length', '2')
            .expect([])
            .expect(200, done);
    });
});
