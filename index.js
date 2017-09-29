const newrelic = require('newrelic');
const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const compression = require('compression');
const cors = require('cors');
const Rollbar = require('rollbar');
const postal = require('postal');
const queueEventHandler = require('./queue-event-handler');
const applicationEventHandler = require('./application-event-handler');
const queue = require('./routes-queue');
const webhook = require('./routes-webhook');
const pullRequest = require('./routes-pullrequest');
const analytics = require('./analytics');
const logger = require('./logger');

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

app.use(bodyParser.json());
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

app.use(req => newrelic.addCustomParameter('username', req.username));

// error handlers
app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500 && !development) {
        rollbar.error(err, req);
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

module.exports = app.listen(app.get('port'), () => {
    postal.publish({
        channel: 'application',
        topic: 'started',
        data: {
            port: app.get('port'),
        },
    });
});
