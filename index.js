const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const compression = require('compression');
const cors = require('cors');
const Rollbar = require('rollbar');
const newrelic = require('newrelic');
const queue = require('./routes-queue');
const webhook = require('./routes-webhook');

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
app.use(cors({ origin: 'https://app.branch-bookkeeper.com' }));

app.use('/queue', queue);
app.use('/webhook', webhook);

app.disable('x-powered-by');
app.enable('trust proxy');

if (!test) {
    app.use(morgan('combined'));
}

// error handlers
app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) {
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
    console.info(`ugo started on port ${app.get('port')}`);
});
