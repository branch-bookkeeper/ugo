const redis = require('./redis');
const postal = require('postal');
const Github = require('./github');
const { evolve, map, pick } = require('ramda');
const prefix = 'installation';
const infoPrefix = 'info';

class InstallationManager {
    static getInstallationId(owner) {
        return redis.hget(prefix, owner);
    }

    static setInstallationId(owner, installationId) {
        if (redis.enabled()) {
            return redis.hset(prefix, `${owner}`, installationId)
                .then(() => {
                    postal.publish({
                        channel: 'installation',
                        topic: 'id.set',
                        data: {
                            owner,
                            installationId,
                        },
                    });
                });
        }
        return Promise.resolve();
    }

    static deleteInstallationId(owner) {
        if (redis.enabled()) {
            return redis.hdel(prefix, owner)
                .then(() => {
                    postal.publish({
                        channel: 'installation',
                        topic: 'id.delete',
                        data: {
                            owner,
                        },
                    });
                });
        }
        return Promise.resolve();
    }

    static getInstallationInfo(token, installationId) {
        if (redis.enabled()) {
            return redis.get(`${prefix}:${infoPrefix}:${installationId}:${token}`)
                .then(installationInfo => {
                    if (!installationInfo) {
                        return InstallationManager._getInstallationInfoFromGithub(token, installationId);
                    }
                    return installationInfo;
                });
        }
        return InstallationManager._getInstallationInfoFromGithub(token, installationId);
    }

    static deleteInstallationInfos(installationId) {
        if (redis.enabled()) {
            return redis.keys(`${prefix}:${infoPrefix}:${installationId}`)
                .then(keys => Promise.all(keys.map(redis.del)))
                .then(() => {
                    postal.publish({
                        channel: 'installation',
                        topic: 'info.delete',
                        data: {
                            installationId,
                        },
                    });
                });
        }
        return Promise.resolve();
    }

    static _getInstallationInfoFromGithub(token, installationId) {
        return Github.getInstallationInfo(token, installationId)
            .then(evolve({ repositories: map(pick(['full_name', 'permissions'])) }))
            .then(installationInfo => InstallationManager._setInstallationInfo(installationId, installationInfo, token));
    }

    static _setInstallationInfo(installationId, installationInfo, token) {
        if (redis.enabled() && installationInfo) {
            redis.set(`${prefix}:info:${installationId}:${token}`, installationInfo, 86400)
                .then(() => {
                    postal.publish({
                        channel: 'installation',
                        topic: 'info.set',
                        data: {
                            installationId,
                            installationInfo,
                            token,
                        },
                    });
                })
                .then(() => installationInfo);
        }
        return installationInfo;
    }
}

module.exports = InstallationManager;
