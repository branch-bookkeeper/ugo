const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const compression = require('compression');
const queue = require('./routes-queue');
const webhook = require('./routes-webhook');

const app = express();

const environment = app.get('env') || 'production';
const development = environment === 'development';
const test = environment === 'test';

app.set('port', process.env.PORT || 3000);

app.use(bodyParser.json());
app.use(compression());

app.use('/queue', queue);
app.use('/webhook', webhook);

app.disable('x-powered-by');
app.enable('trust proxy');

if (!test) {
    app.use(morgan('combined'));
}

// error handlers
app.use((err, req, res, next) => {
    res.status(err.status || 500).json({
        stack: development ? err.stack : undefined,
        error: err.message,
    });
});

if (!test) {
    app.use(morgan('combined'));
}
app.set('port', process.env.PORT || 3000);

app.get('/', (req, res) => {
    res.send('Ciao Pina!');
});

module.exports = app.listen(app.get('port'), () => {
    console.info(`ugo started on port ${app.get('port')}`);
});
