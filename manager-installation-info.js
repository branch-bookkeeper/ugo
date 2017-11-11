const redis = require('./redis');
const postal = require('postal');
const Github = require('./github');
const { evolve, map, pick } = require('ramda');
const prefix = 'installation:info';

class InstallationInfoManager {
    static getInstallationInfo(token, installationId) {
        if (redis.enabled()) {
            return redis.get(`${prefix}:${installationId}:${token}`)
                .then(installationInfo => {
                    if (!installationInfo) {
                        return InstallationInfoManager._getInstallationInfoFromGithub(token, installationId);
                    }
                    return installationInfo;
                });
        }
        return InstallationInfoManager._getInstallationInfoFromGithub(token, installationId);
    }

    static deleteInstallationInfos(installationId) {
        if (redis.enabled()) {
            return redis.keys(`${prefix}:${installationId}`)
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
            .then(installationInfo => InstallationInfoManager._setInstallationInfo(installationId, installationInfo, token));
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

module.exports = InstallationInfoManager;
