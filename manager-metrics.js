const metrics = require('datadog-metrics');
const postal = require('postal');
const environment = process.env.NODE_ENV || 'production';
const development = environment === 'development';

metrics.init({
    prefix: 'ugo.',
    defaultTags: [`env:${environment}`],
});

class MetricsManager {
    static gauge(options) {
        const {
            name,
            value,
            tags,
            timestamp,
        } = options;
        return metrics.gauge(name, value, tags, timestamp);
    }

    static increment(options) {
        const {
            name,
            value,
            tags,
            timestamp,
        } = options;
        return metrics.increment(name, value, tags, timestamp);
    }

    static histogram(options) {
        const {
            name,
            value,
            tags,
            timestamp,
        } = options;
        return metrics.histogram(name, value, tags, timestamp);
    }
}

postal.subscribe({
    channel: 'metrics',
    topic: 'gauge',
    callback: MetricsManager.gauge,
});

postal.subscribe({
    channel: 'metrics',
    topic: 'increment',
    callback: MetricsManager.increment,
});

postal.subscribe({
    channel: 'metrics',
    topic: 'histogram',
    callback: MetricsManager.histogram,
});

module.exports = MetricsManager;
