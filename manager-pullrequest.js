const mongoManager = require('./manager-mongo');
const postal = require('postal');
const COLLECTION_NAME = 'pullRequest';

class PullRequestManager {
    static setPullRequestInfo(owner, repo, number, info) {
        return mongoManager.getCollection(COLLECTION_NAME)
            .then(collection => collection.updateOne(
                {
                    _id: `${owner}-${repo}-${number}`,
                },
                {
                    $set: {
                        ...info,
                        owner,
                        repo,
                    },
                },
                {
                    upsert: true,
                }
            ))
            .then(() => {
                postal.publish({
                    channel: 'pullRequest',
                    topic: 'info.set',
                    data: {
                        owner,
                        repo,
                        number,
                        info,
                    },
                });
            })
            .then(() => info);
    }

    static getPullRequestInfo(owner, repo, number) {
        return mongoManager.getCollection(COLLECTION_NAME)
            .then(collection => collection.findOne(
                { _id: `${owner}-${repo}-${number}` },
                { fields: { _id: false, owner: false, repo: false } }
            ));
    }

    static getRepositoryPullRequestsInfo(owner, repo) {
        return mongoManager.getCollection(COLLECTION_NAME)
            .then(collection => collection.find(
                { owner, repo },
                { fields: { _id: false, owner: false, repo: false } }
            ))
            .then(cursor => cursor.toArray());
    }

    static getPullRequestInfoBySha(owner, repo, sha) {
        return mongoManager.getCollection(COLLECTION_NAME)
            .then(collection => collection.findOne(
                { owner, repo, sha },
                { fields: { _id: false, owner: false, repo: false } }
            ));
    }

    static deletePullRequestInfo(owner, repo, number) {
        return mongoManager.getCollection(COLLECTION_NAME)
            .then(collection => collection.deleteOne({ _id: `${owner}-${repo}-${number}` }))
            .then(() => {
                postal.publish({
                    channel: 'pullRequest',
                    topic: 'info.delete',
                    data: {
                        owner,
                        repo,
                        number,
                    },
                });
            });
    }

    static deletePullRequestInfos(owner) {
        return mongoManager.getCollection(COLLECTION_NAME)
            .then(collection => collection.deleteMany({ owner }))
            .then(() => {
                postal.publish({
                    channel: 'pullRequest',
                    topic: 'info.delete',
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

module.exports = PullRequestManager;
