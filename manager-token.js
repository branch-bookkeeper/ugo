const mongoManager = require('./manager-mongo');
const postal = require('postal');
const Github = require('./github');
const COLLECTION_NAME = 'githubToken';

class TokenManager {
    static getTokenInfo(token) {
        if (mongoManager.enabled()) {
            return mongoManager.getCollection(COLLECTION_NAME)
                .then(collection => collection.findOne(
                    { _id: token },
                    { projection: { _id: false, created_at: false, updated_at: false } }
                ))
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
        if (mongoManager.enabled() && tokenInfo) {
            return mongoManager.getCollection(COLLECTION_NAME)
                .then(collection => collection.updateOne(
                    {
                        _id: token,
                    },
                    {
                        $set: {
                            ...tokenInfo,
                            updated_at: new Date(tokenInfo.updated_at),
                            created_at: new Date(),
                        },
                    },
                    {
                        upsert: true,
                    }
                ))
                .then(() => {
                    postal.publish({
                        channel: 'token',
                        topic: 'info.add',
                        data: {
                            token,
                            tokenInfo,
                        },
                    });
                })
                .then(() => tokenInfo);
        }
        return Promise.resolve(tokenInfo);
    }
}

module.exports = TokenManager;
