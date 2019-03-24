const mongoManager = require('./manager-mongo');
const postal = require('postal');
const GitHub = require('./github');
const {
    evolve,
    map,
    pick,
    isNil,
} = require('ramda');
const COLLECTION_NAME = 'installationInfo';

class InstallationInfoManager {
    static getInstallationInfo(token, installationId) {
        if (mongoManager.enabled()) {
            return mongoManager.getCollection(COLLECTION_NAME)
                .then(collection => collection.findOne(
                    { _id: `${installationId}-${token}` },
                    { projection: { _id: false, created_at: false, installationId: false } }
                ))
                .then(installationInfo => {
                    if (isNil(installationInfo)) {
                        return InstallationInfoManager._getInstallationInfoFromGitHub(token, installationId);
                    }
                    return installationInfo;
                });
        }
        return InstallationInfoManager._getInstallationInfoFromGitHub(token, installationId);
    }

    static deleteInstallationInfos(installationId) {
        if (mongoManager.enabled()) {
            return mongoManager.getCollection(COLLECTION_NAME)
                .then(collection => collection.deleteMany({ installationId }))
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

    static _getInstallationInfoFromGitHub(token, installationId) {
        return GitHub.getInstallationInfo(token, installationId)
            .then(evolve({ repositories: map(pick(['full_name', 'permissions'])) }))
            .then(installationInfo => InstallationInfoManager._setInstallationInfo(installationId, installationInfo, token));
    }

    static _setInstallationInfo(installationId, installationInfo, token) {
        if (mongoManager.enabled() && installationInfo) {
            return mongoManager.getCollection(COLLECTION_NAME)
                .then(collection => collection.updateOne(
                    {
                        _id: `${installationId}-${token}`,
                    },
                    {
                        $set: {
                            ...installationInfo,
                            installationId,
                            created_at: new Date(),
                        },
                    },
                    {
                        upsert: true,
                    }
                ))
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
