const createError = require('http-errors');
const logger = require('./logger');
const installationManager = require('./manager-installation');
const installationInfoManager = require('./manager-installation-info');
const tokenManager = require('./manager-token');
const {
    propEq,
    find,
    curry,
    isNil,
} = require('ramda');
const { env: { NODE_ENV: environment = 'production', CLIENT_ID: appClientId  } } = process;
const development = environment === 'development';
const test = environment === 'test';

const throwErrorIf = curry((condition, message, input) => {
    if (condition(input)) {
        throw new Error(message);
    }

    return input;
});

const throwErrorIfNil = throwErrorIf(isNil);

const authenticator = (req, res, next) => {
    if (test || development) {
        return next();
    }

    const authHeader = req.get('authorization');

    if (!authHeader || authHeader.indexOf('token ') !== 0) {
        return next(createError.Unauthorized('Unauthorized'));
    }

    const token = authHeader.replace('token ', '');
    const { params: { owner, repository } } = req;

    tokenManager.getTokenInfo(token)
        .then(tokenInfo => {
            const { client_id: clientId, login } = tokenInfo;
            if (clientId === appClientId) {
                req.username = login;
            } else {
                throw new Error('Wrong client id');
            }
        })
        .then(() => installationManager.getInstallationId(owner))
        .then(throwErrorIfNil('No installation id'))
        .then(installationId => installationInfoManager.getInstallationInfo(token, installationId))
        .then(throwErrorIfNil('No installation found'))
        .then(({ repositories }) => find(propEq('full_name', `${owner}/${repository}`), repositories))
        .then(throwErrorIfNil('Repository not found'))
        .then(({ permissions: { push: canPush = false, pull: canPull = false, admin: isAdmin = false } }) => {
            if (!canPush || !canPull) {
                throw new Error('Repository not accessible');
            }
        })
        .then(next)
        .catch(error => {
            logger.error(error);
            next(createError.Unauthorized('Unauthorized'));
        });
};

module.exports = authenticator;
