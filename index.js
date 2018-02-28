const newrelic = require('newrelic');
const express = require('express');
const morgan = require('morgan');
const compression = require('compression');
const cors = require('cors');
const Rollbar = require('rollbar');
const queue = require('./routes-queue');
const webhook = require('./routes-webhook');
const pullRequest = require('./routes-pullrequest');
const analytics = require('./analytics');
const logger = require('./logger');
require('./queue-event-handler');
require('./manager-notification-push');
require('./manager-metrics');

const app = express();

const environment = app.get('env') || 'production';
const development = environment === 'development';
const test = environment === 'test';

const rollbar = new Rollbar({
    accessToken: process.env['ROLLBAR_KEY'],
    environment: environment,
    captureUncaught: !development,
    captureUnhandledRejections: !development,
});

app.set('port', process.env.PORT || 3000);

app.use(express.json());
app.use(compression());
app.use(cors({ origin: process.env.APP_ORIGIN || 'http://localhost:4000' }));

if (!test) {
    morgan.token('remote-user', req => req.username);
    app.use(morgan('combined', { stream: logger }));
}

if (process.env['UA']) {
    app.use(analytics.trackRequest);
}

app.use('/queue', queue);
app.use('/pull-request', pullRequest);
app.use('/webhook', webhook);

app.disable('x-powered-by');
app.disable('etag');
app.enable('trust proxy');

app.use((req, res, next) => {
    newrelic.addCustomParameter('username', req.username);
    next();
});

// error handlers
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
app.set('port', process.env.PORT || 3000);

app.get('/', (req, res) => {
    res.send('');
});

module.exports = app.listen(app.get('port'));
