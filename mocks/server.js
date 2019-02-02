const statusSuccess = require('../test/fixtures/status.success');
const suitesSuccess = require('../test/fixtures/suites.success');
const repositories = require('../test/fixtures/installation.info');
const pullRequest = require('../test/fixtures/pull_request.info');
const user = require('../test/fixtures/token.info');

const accessTokens = {
    token: 'fake',
};

module.exports = () => {
    return {
        status: statusSuccess,
        suites: suitesSuccess,
        accessTokens,
        repositories,
        pullRequest,
        user,
    };
};
