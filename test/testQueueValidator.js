/* globals test, setup, suiteSetup, suite */
const { assert } = require('chai');
const sinon = require('sinon');
const validator = require('../validator-queue');
const queueItemFixture = require('./fixtures/queue.item');
const req = {};
const res = {};

sinon.assert.expose(assert, { prefix: '' });

suite('Validator queue', () => {
    setup(() => {
        req.body = {
            ...queueItemFixture,
        };
    });

    test('validData', () => {
        const nextSpy = sinon.stub();
        validator(req, res, nextSpy);
        assert.called(nextSpy);

        const args = nextSpy.getCall(0).args;
        assert.isArray(args);
        assert.empty(args);
    });

    test('missingData', () => {
        delete req.body.username;

        const nextSpy = sinon.stub();
        validator(req, res, nextSpy);
        assert.called(nextSpy);

        const args = nextSpy.getCall(0).args;
        assert.isArray(args);
        assert.notEmpty(args);
        assert.lengthOf(args, 1);

        const arg = args[0];
        assert.instanceOf(arg, Error);
        assert.propertyVal(arg, 'message', '"username" is required');
        assert.propertyVal(arg, 'status', 400);
    });

    test('invalidData', () => {
        req.body.username = 7;

        const nextSpy = sinon.stub();
        validator(req, res, nextSpy);
        assert.called(nextSpy);

        const args = nextSpy.getCall(0).args;
        assert.isArray(args);
        assert.notEmpty(args);
        assert.lengthOf(args, 1);

        const arg = args[0];
        assert.instanceOf(arg, Error);
        assert.propertyVal(arg, 'message', '"username" must be a string');
        assert.propertyVal(arg, 'status', 400);
    });

});
