/* globals test, setup, suiteSetup, suite */
const proxyquire =  require('proxyquire');
const { assert } = require('chai');
const sinon = require('sinon');
const userAgent = 'Mozilla';
const username = 'username';
const account = 'account';
const ip = '0.0.0.0';
const protocol = 'https';
const hostname = 'localhost';
const originalUrl = '/fake';
const userAgentArg = 'User-Agent';
const resEndSpy = sinon.stub();
const reqGetSpy = sinon.stub().withArgs(userAgentArg).returns(userAgent);
const req = {
    get: reqGetSpy,
    user: {
        username,
    },
    ip,
    protocol,
    hostname,
    originalUrl,
};
const res = { end: resEndSpy };
const nextSpy = sinon.stub();
const visitorSendSpy = sinon.stub();
const visitorPageviewSpy = sinon.stub().returns({ send: visitorSendSpy });
const uaSpy = sinon.stub().returns({ pageview: visitorPageviewSpy });

process.env.UA = account;
const analytics = proxyquire('../analytics', { 'universal-analytics': uaSpy });

sinon.assert.expose(assert, { prefix: '' });

suite('Analytics', () => {
    teardown(() => {
        delete process.env.UA;
    });

    test('trackRequest', () => {
        // Simulate an incoming request
        analytics.trackRequest(req, res, nextSpy);

        assert.calledWith(nextSpy);
        assert.notCalled(uaSpy);
        assert.notCalled(visitorPageviewSpy);
        assert.notCalled(visitorSendSpy);
        assert.notCalled(resEndSpy);
        assert.notCalled(reqGetSpy);

        // Simulate response sending
        res.end();

        assert.calledWith(uaSpy, account, username);
        assert.calledWith(reqGetSpy, userAgentArg);
        assert.calledWith(visitorPageviewSpy, {
            userId: username,
            ipOverride: ip,
            userAgentOverride: userAgent,
            hitType: 'pageview',
            documentLocationUrl: `${protocol}://${hostname}${originalUrl}`,
        });
        assert.calledWith(visitorSendSpy);
        assert.calledWith(resEndSpy);
    });
});
