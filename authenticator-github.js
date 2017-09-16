const redis = require('./redis');
const createError = require('http-errors');
const Github = require('./github');
const prefix = 'authentication:token:github';
const environment = process.env.NODE_ENV || 'production';
const development = environment === 'development';
const test = environment === 'test';

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
            const { client_id: clientId } = tokenInfo;
            if (clientId === process.env.CLIENT_ID) {
                next();
            } else {
                next(createError.Unauthorized('Unauthorized'));
            }
        })
        .catch(next);
};

const _getTokenInfo = (token) => {
    if (redis.enabled()) {
        return redis.get(`${prefix}:${token}`)
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
        redis.set(`${prefix}:${token}`, tokenInfo, 86400)// TODO TTL
            .then(() => tokenInfo);
    }
    return tokenInfo;
};

module.exports = authenticator;
