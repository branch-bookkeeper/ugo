const newrelic = require('newrelic');
const express = require('express');
const morgan = require('morgan');
const compression = require('compression');
const cors = require('cors');
const Rollbar = require('rollbar');
const { path } = require('ramda');
const queue = require('./routes-queue');
const webhook = require('./routes-webhook');
const pullRequest = require('./routes-pullrequest');
const analytics = require('./analytics');
const logger = require('./logger');
const {
    env: {
        ROLLBAR_KEY: rollbarAccessToken,
        PORT: port = 3000,
        APP_ORIGIN: appOrigin = 'http://localhost:4000',
        UA: analyticsUa,
    },
} = process;
require('./handler-event-queue');
require('./handler-notification-push');
require('./handler-notification-pusher');
require('./manager-metrics');

const app = express();

const environment = app.get('env') || 'production';
const development = environment === 'development';
const test = environment === 'test';

const rollbar = new Rollbar({
    accessToken: rollbarAccessToken,
    environment: environment,
    captureUncaught: !development,
    captureUnhandledRejections: !development,
});

app.use(express.json());
app.use(compression());
app.use(cors({ origin: appOrigin }));

morgan.token('remote-user', path(['user', 'username']));
app.use(morgan('combined', { stream: logger }));

if (analyticsUa) {
    app.use(analytics.trackRequest);
}

app.use('/queue', queue);
app.use('/pull-request', pullRequest);
app.use('/webhook', webhook);

app.disable('x-powered-by');
app.disable('etag');
app.enable('trust proxy');

app.use((req, res, next) => {
    newrelic.addCustomAttribute('username', path(['user', 'username'], req));
    next();
});

// error handlers
if (!development) {
    app.use(rollbar.errorHandler());
}
app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500 && !development) {
        rollbar.error(err, req);
    }
    if (development) {
        logger.error(err.stack);
    }
    res.status(status).json({
        stack: development ? err.stack : undefined,
        error: err.message,
    });
});

if (!test) {
    app.use(morgan('combined'));
}

app.get('/', (req, res) => {
    res.send('');
});

module.exports = app.listen(port);
