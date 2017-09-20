const redis = require('./redis');
const createError = require('http-errors');
const Github = require('./github');
const logger = require('./logger');
const {
    propEq,
    find,
    curry,
    isNil,
} = require('ramda');
const tokenPrefix = 'authentication:token:github';
const installationPrefix = 'installation';
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

    _getTokenInfo(token)
        .then(tokenInfo => {
            const { client_id: clientId, login } = tokenInfo;
            if (clientId === process.env.CLIENT_ID) {
                req.username = login;
            } else {
                throw new Error('Wrong client id');
            }
        })
        .then(() => redis.hget(installationPrefix, `${req.params.owner}:${req.params.repository}`))
        .then(throwErrorIfNil(new Error('No installation id')))
        .then(installationId => _getInstallationInfo(token, installationId))
        .then(installationInfo => {
            if (!installationInfo) {
                throw new Error('No installation found');
            }
            const { repositories } = installationInfo;
            const item = find(propEq('full_name', `${req.params.owner}/${req.params.repository}`))(repositories);

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

const _getInstallationInfo = (token, installationId) => {
    if (redis.enabled()) {
        return redis.get(`${installationPrefix}:info:${installationId}:${token}`)
            .then(installationInfo => {
                if (!installationInfo) {
                    return _getInstallationInfoFromGithub(token, installationId);
                }
                return installationInfo;
            });
    }
    return _getInstallationInfoFromGithub(token, installationId);
};

const _getInstallationInfoFromGithub = (token, installationId) => {
    return Github.getInstallationInfo(token, installationId)
        .then(installationInfo => _setInstallationInfo(installationId, installationInfo, token));
};

const _setInstallationInfo = (installationId, installationInfo, token) => {
    if (redis.enabled() && installationInfo) {
        redis.set(`${installationPrefix}:info:${installationId}:${token}`, installationInfo, 86400)
            .then(() => installationInfo);
    }
    return installationInfo;
};

const _getTokenInfo = (token) => {
    if (redis.enabled()) {
        return redis.get(`${tokenPrefix}:${token}`)
            .then(tokenInfo => {
                if (!tokenInfo) {
                    return _getTokenInfoFromGithub(token);
                }
                return tokenInfo;
            });
    }
    return _getTokenInfoFromGithub(token);
};

const _getTokenInfoFromGithub = (token) => {
    return Github.getUserInfo(token)
        .then(tokenInfo => _setTokenInfo(token, tokenInfo));
};

const _setTokenInfo = (token, tokenInfo) => {
    if (redis.enabled() && tokenInfo) {
        redis.set(`${tokenPrefix}:${token}`, tokenInfo, 86400)
            .then(() => tokenInfo);
    }
    return tokenInfo;
};

module.exports = authenticator;
