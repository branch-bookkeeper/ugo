const winston = require('winston');
const { env: { LOGENTRIES_TOKEN: logentriesToken, NODE_ENV: environment = 'production' } } = process;
const development = environment === 'development';
const test = environment === 'test';
const logger = winston.createLogger({ exitOnError: false });
require('r7insight_node');

if (!development && logentriesToken) {
    logger.add(new winston.transports.Insight({ token: logentriesToken, region: 'eu', console: true }));
} else if (!test) {
    logger.add(new winston.transports.Console({ format: winston.format.simple() }));
}

module.exports = logger;
