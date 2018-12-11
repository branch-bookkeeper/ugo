const mongoManager = require('./manager-mongo');

const COLLECTION_NAME = 'pushNotification';

const getNotificationId = ({
    owner,
    repo,
    pullRequestNumber,
    username,
    type,
}) => `${owner}-${repo}-${pullRequestNumber}-${username}-${type}`;

const saveNotification = data => !mongoManager.enabled()
    ? Promise.resolve(data)
    : mongoManager.getCollection(COLLECTION_NAME)
        .then(collection => collection.updateOne(
            {
                _id: getNotificationId(data),
            },
            {
                $set: {
                    ...data,
                    createdAt: new Date(),
                },
            },
            {
                upsert: true,
            }
        ))
        .then(() => data);

const getNotification = id => !mongoManager.enabled()
    ? Promise.resolve()
    : mongoManager.getCollection(COLLECTION_NAME)
        .then(collection => collection.findOne(
            { _id: id },
            { projection: { id: true } }
        ));

const deleteNotification = id => !mongoManager.enabled()
    ? Promise.resolve(id)
    : mongoManager.getCollection(COLLECTION_NAME)
        .then(collection => collection.deleteOne({ _id: id }))
        .then(() => id);

module.exports = {
    saveNotification,
    getNotification,
    deleteNotification,
    getNotificationId,
};
