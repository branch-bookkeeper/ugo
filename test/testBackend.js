/* globals test, suiteTeardown, suiteSetup, suite */
const request = require('supertest');
const { assert } = require('chai');
const mongoManager = require('../manager-mongo');
let server;
let randomNumber = Math.round(Math.random() * 100);
const randomObject = {};
const url = '/queue/branch-bookkeeper/branch-bookkeeper/master';

suite('Backend', () => {
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

    test('GET empty list', (done) => {
        request(server)
            .get(url)
            .expect('content-type', /application\/json/)
            .expect('content-length', '2')
            .expect([])
            .expect(200, done);
    });

    test('POST first item', (done) => {
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

    test('POST second item', (done) => {
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

    test('POST third item', (done) => {
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

    test('GET list with three items', (done) => {
        request(server)
            .get(url)
            .expect('content-type', /application\/json/)
            .expect('content-length', '169')
            .expect(res => {
                assert.equal(res.body[0].pullRequestNumber, randomNumber + 1);
                assert.equal(res.body[1].pullRequestNumber, randomNumber + 2);
                assert.equal(res.body[2].pullRequestNumber, randomNumber + 3);
            })
            .expect(200, done);
    });

    test('DELETE second item', (done) => {
        randomObject.pullRequestNumber = randomNumber + 2;
        request(server)
            .delete(url)
            .send(randomObject)
            .expect(res => {
                assert.empty(res.body);
            })
            .expect(204, done);
    });

    test('GET list with first and third item', (done) => {
        request(server)
            .get(url)
            .expect('content-type', /application\/json/)
            .expect('content-length', '113')
            .expect(res => {
                assert.equal(res.body[0].pullRequestNumber, randomNumber + 1);
                assert.equal(res.body[1].pullRequestNumber, randomNumber + 3);
            })
            .expect(200, done);
    });

    test('DELETE first item', (done) => {
        randomObject.pullRequestNumber = randomNumber + 1;
        request(server)
            .delete(url)
            .send(randomObject)
            .expect(res => {
                assert.empty(res.body);
            })
            .expect(204, done);
    });

    test('GET list with item three', (done) => {
        request(server)
            .get(url)
            .expect('content-type', /application\/json/)
            .expect('content-length', '57')
            .expect(res => {
                assert.equal(res.body[0].pullRequestNumber, randomNumber + 3);
            })
            .expect(200, done);
    });

    test('DELETE third item', (done) => {
        randomObject.pullRequestNumber = randomNumber + 3;
        request(server)
            .delete(url)
            .send(randomObject)
            .expect(res => {
                assert.empty(res.body);
            })
            .expect(204, done);
    });

    test('GET empty list', (done) => {
        request(server)
            .get(url)
            .expect('content-type', /application\/json/)
            .expect('content-length', '2')
            .expect([])
            .expect(200, done);
    });
});
