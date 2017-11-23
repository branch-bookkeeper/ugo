/* globals test, setup, suiteSetup, suite */
const { assert } = require('chai');
const sinon = require('sinon');
const metrics = require('datadog-metrics');
const metricsManager = require('../manager-metrics');
let dataDogGaugeSpy;
let dataDogIncrementSpy;
let dataDogHistogramSpy;

sinon.assert.expose(assert, { prefix: '' });

suite('MetricsManager', () => {
    suiteSetup(function () {
        dataDogGaugeSpy = sinon.stub(metrics, 'gauge');
        dataDogIncrementSpy = sinon.stub(metrics, 'increment');
        dataDogHistogramSpy = sinon.stub(metrics, 'histogram');
    });

    suiteTeardown(() => {
        dataDogGaugeSpy.restore();
        dataDogIncrementSpy.restore();
        dataDogHistogramSpy.restore();
    });

    test('gauge', () => {
        metricsManager.gauge({
            name: 'fake_metric',
            value: 2,
            tags: 'fake:tag',
        });

        assert.calledWith(dataDogGaugeSpy, 'fake_metric', 2, 'fake:tag');
    });

    test('increment', () => {
        metricsManager.increment({
            name: 'fake_metric',
            value: 2,
            tags: 'fake:tag',
        });

        assert.calledWith(dataDogIncrementSpy, 'fake_metric', 2, 'fake:tag');
    });

    test('histogram', () => {
        metricsManager.histogram({
            name: 'fake_metric',
            value: 2,
            tags: 'fake:tag',
        });

        assert.calledWith(dataDogHistogramSpy, 'fake_metric', 2, 'fake:tag');
    });
});
