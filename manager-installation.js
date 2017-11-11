const redis = require('./redis');
const postal = require('postal');
const prefix = 'installation';

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
}

module.exports = InstallationManager;
