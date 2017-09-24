const redis = require('./redis');
const postal = require('postal');
const Github = require('./github');
const prefix = 'authentication:token:github';

class TokenManager {
    static getTokenInfo(token) {
        if (redis.enabled()) {
            return redis.get(`${prefix}:${token}`)
                .then(tokenInfo => {
                    if (!tokenInfo) {
                        return TokenManager.getTokenInfoFromGithub(token);
                    }
                    return tokenInfo;
                });
        }
        return TokenManager.getTokenInfoFromGithub(token);
    }

    static getTokenInfoFromGithub(token) {
        return Github.getUserInfo(token)
            .then(tokenInfo => TokenManager.setTokenInfo(token, tokenInfo));
    }

    static setTokenInfo(token, tokenInfo) {
        if (redis.enabled() && tokenInfo) {
            redis.set(`${prefix}:${token}`, tokenInfo, 86400)
                .then(data => {
                    postal.publish({
                        channel: 'token',
                        topic: 'info.add',
                        data: {
                            token,
                            tokenInfo,
                        },
                    });
                    return data;
                })
                .then(() => tokenInfo);
        }
        return tokenInfo;
    }
}

module.exports = TokenManager;
