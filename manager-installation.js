const mongoManager = require('./manager-mongo');
const postal = require('postal');
const { path } = require('ramda');
const COLLECTION_NAME = 'installation';

class InstallationManager {
    static getInstallationId(owner) {
        return mongoManager.getCollection(COLLECTION_NAME)
            .then(collection => collection.find({ owner }))
            .then(cursor => cursor.toArray())
            .then(path([0, 'installationId']));
    }

    static setInstallationId(owner, installationId) {
        return mongoManager.getCollection(COLLECTION_NAME)
            .then(collection => collection.updateOne(
                {
                    _id: installationId,
                },
                {
                    $set: {
                        installationId,
                        owner,
                    },
                },
                {
                    upsert: true,
                }
            ))
            .then(() => {
                postal.publish({
                    channel: COLLECTION_NAME,
                    topic: 'id.set',
                    data: {
                        owner,
                        installationId,
                    },
                });
            })
            .then(() => installationId);
    }

    static deleteInstallationId(owner) {
        return mongoManager.getCollection(COLLECTION_NAME)
            .then(collection => collection.deleteMany({ owner }))
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

    static enabled() {
        return mongoManager.enabled();
    }
}

module.exports = InstallationManager;
