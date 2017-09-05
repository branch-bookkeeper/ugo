/* globals test, suiteTeardown, suiteSetup, suite */
const request = require('supertest');
const assert = require('chai').assert;
let server;
let randomKey;
let randomObject;
let url;

suite('Backend', () => {
    suiteSetup(function (done) {
        delete require.cache[require.resolve('../index')];
        delete require.cache[require.resolve('../redis')];
        randomKey = Math.random().toString(36).substr(2, 7);
        randomObject = { data: randomKey };
        url = '/queue/branch-bookkeeper/branch-bookkeeper/master' + randomKey;
        server = require('../index');
        const redis = require('../redis');
        if (!redis.enabled()) {
            this.skip();
        } else {
            redis.on('ready', done);
        }
    });

    suiteTeardown(done => {
        server.close(done);
    });

    test('GET empty list', (done) => {
        request(server)
            .get(url)
            .expect('content-type', /application\/json;/)
            .expect('content-length', '2')
            .expect([])
            .expect(200, done);
    });

    test('POST first item', (done) => {
        randomObject.data = '1-' + randomKey;
        request(server)
            .post(url)
            .send(randomObject)
            .expect('content-type', /application\/json;/)
            .expect('content-length', '1')
            .expect(res => {
                assert.equal(res.body, 1);
            })
            .expect(201, done);
    });

    test('POST second item', (done) => {
        randomObject.data = '2-' + randomKey;
        request(server)
            .post(url)
            .send(randomObject)
            .expect('content-type', /application\/json;/)
            .expect('content-length', '1')
            .expect(res => {
                assert.equal(res.body, 2);
            })
            .expect(201, done);
    });

    test('POST third item', (done) => {
        randomObject.data = '3-' + randomKey;
        request(server)
            .post(url)
            .send(randomObject)
            .expect('content-type', /application\/json;/)
            .expect('content-length', '1')
            .expect(res => {
                assert.equal(res.body, 3);
            })
            .expect(201, done);
    });

    test('GET list with three items', (done) => {
        request(server)
            .get(url)
            .expect('content-type', /application\/json;/)
            .expect('content-length', '64')
            .expect(res => {
                assert.equal(res.body[0].data, '1-' + randomKey);
                assert.equal(res.body[1].data, '2-' + randomKey);
                assert.equal(res.body[2].data, '3-' + randomKey);
            })
            .expect(200, done);
    });

    test('DELETE second item', (done) => {
        randomObject.data = '2-' + randomKey;
        request(server)
            .delete(url)
            .send(randomObject)
            .expect('content-type', /application\/json;/)
            .expect('content-length', '20')
            .expect(res => {
                assert.equal(res.body.data, '2-' + randomKey);
            })
            .expect(200, done);
    });

    test('GET list with first and third item', (done) => {
        request(server)
            .get(url)
            .expect('content-type', /application\/json;/)
            .expect('content-length', '43')
            .expect(res => {
                assert.equal(res.body[0].data, '1-' + randomKey);
                assert.equal(res.body[1].data, '3-' + randomKey);
            })
            .expect(200, done);
    });

    test('DELETE first item', (done) => {
        randomObject.data = '1-' + randomKey;
        request(server)
            .delete(url)
            .send(randomObject)
            .expect('content-type', /application\/json;/)
            .expect('content-length', '20')
            .expect(res => {
                assert.equal(res.body.data, '1-' + randomKey);
            })
            .expect(200, done);
    });

    test('GET list with item three', (done) => {
        request(server)
            .get(url)
            .expect('content-type', /application\/json;/)
            .expect('content-length', '22')
            .expect(res => {
                assert.equal(res.body[0].data, '3-' + randomKey);
            })
            .expect(200, done);
    });
});
