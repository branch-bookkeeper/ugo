/* globals test, suiteTeardown, suiteSetup, suite */
const request = require('supertest');
const { assert } = require('chai');
const { pathOr } = require('ramda');
const mongoManager = require('../manager-mongo');
let server;
const randomNumber = Math.floor(Math.random() * 89) + 10;
const randomObject = { username: 'branch-bookkeeper' };
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

    test('Add first item', done => {
        randomObject.pullRequestNumber = randomNumber + 1;
        request(server)
            .post(url)
            .send(randomObject)
            .expect('content-type', /application\/json/)
            .expect(res => {
                assert.empty(res.body);
            })
            .expect(201, done);
    });

    test('Add second item', done => {
        randomObject.pullRequestNumber = randomNumber + 2;
        request(server)
            .post(url)
            .send(randomObject)
            .expect('content-type', /application\/json/)
            .expect(res => {
                assert.empty(res.body);
            })
            .expect(201, done);
    });

    test('Add third item', done => {
        randomObject.pullRequestNumber = randomNumber + 3;
        request(server)
            .post(url)
            .send(randomObject)
            .expect('content-type', /application\/json/)
            .expect(res => {
                assert.empty(res.body);
            })
            .expect(201, done);
    });

    test('Get list with three items', done => {
        request(server)
            .get(url)
            .expect('content-type', /application\/json/)
            .expect('content-length', '169')
            .expect(res => {
                assert.deepEqual(pathOr(0, ['body', 0, 'pullRequestNumber'], res), randomNumber + 1);
                assert.deepEqual(pathOr(0, ['body', 1, 'pullRequestNumber'], res), randomNumber + 2);
                assert.deepEqual(pathOr(0, ['body', 2, 'pullRequestNumber'], res), randomNumber + 3);
            })
            .expect(200, done);
    });

    test('Remove second item', done => {
        randomObject.pullRequestNumber = randomNumber + 2;
        request(server)
            .delete(url)
            .send(randomObject)
            .expect(res => {
                assert.empty(res.body);
            })
            .expect(204, done);
    });

    test('Get list with first and third item', done => {
        request(server)
            .get(url)
            .expect('content-type', /application\/json/)
            .expect('content-length', '113')
            .expect(res => {
                assert.deepEqual(pathOr(0, ['body', 0, 'pullRequestNumber'], res), randomNumber + 1);
                assert.deepEqual(pathOr(0, ['body', 1, 'pullRequestNumber'], res), randomNumber + 3);
            })
            .expect(200, done);
    });

    test('Remove first item', done => {
        randomObject.pullRequestNumber = randomNumber + 1;
        request(server)
            .delete(url)
            .send(randomObject)
            .expect(res => {
                assert.empty(res.body);
            })
            .expect(204, done);
    });

    test('Get list with item three', done => {
        request(server)
            .get(url)
            .expect('content-type', /application\/json/)
            .expect('content-length', '57')
            .expect(res => {
                assert.deepEqual(pathOr(0, ['body', 0, 'pullRequestNumber'], res), randomNumber + 3);
            })
            .expect(200, done);
    });

    test('Remove third item', done => {
        randomObject.pullRequestNumber = randomNumber + 3;
        request(server)
            .delete(url)
            .send(randomObject)
            .expect(res => {
                assert.empty(res.body);
            })
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
