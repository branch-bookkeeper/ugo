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
const environment = process.env.NODE_ENV || 'production';
const development = environment === 'development';
const test = environment === 'test';

const throwErrorIf = curry((condition, error, input) => {
    if (condition(input)) {
        throw error;
    }

    return input;
});

const throwErrorIfNil = throwErrorIf(isNil);

const authenticator = (req, res, next) => {
    if (test || development) {
        next();
        return;
    }

    const authHeader = req.get('authorization');

    if (!authHeader || authHeader.indexOf('token ') !== 0) {
        next(createError.Unauthorized('Unauthorized'));
        return;
    }

    const token = authHeader.replace('token ', '');
    const { params: { owner, repository } } = req;

    tokenManager.getTokenInfo(token)
        .then(tokenInfo => {
            const { client_id: clientId, login } = tokenInfo;
            if (clientId === process.env.CLIENT_ID) {
                req.username = login;
            } else {
                throw new Error('Wrong client id');
            }
        })
        .then(() => installationManager.getInstallationId(owner))
        .then(throwErrorIfNil(new Error('No installation id')))
        .then(installationId => installationInfoManager.getInstallationInfo(token, installationId))
        .then(installationInfo => {
            if (!installationInfo) {
                throw new Error('No installation found');
            }
            const { repositories } = installationInfo;
            const item = find(propEq('full_name', `${owner}/${repository}`), repositories);

            if (!item) {
                throw new Error('Repository not found');
            }

            const { permissions: { push: canPush, pull: canPull } } = item;

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
