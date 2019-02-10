const statusSuccess = require('../test/fixtures/status.success');
const suitesSuccess = require('../test/fixtures/check_suites.success');
const runCreated = require('./check_run.created');
const repositories = require('../test/fixtures/installation.info');
const pullRequest = require('../test/fixtures/pull_request.info');
const user = require('../test/fixtures/token.info');

const accessTokens = {
    token: 'fake',
};

module.exports = () => ({
    status: statusSuccess,
    suites: suitesSuccess,
    runCreated,
    accessTokens,
    repositories,
    pullRequest,
    user,
});
