const redis = require('./redis');
const postal = require('postal');
const prefix = 'pullrequest';

class PullRequestManager {
    static setPullRequestInfo(owner, repo, number, info) {
        return redis.set(`${prefix}:${owner}:${repo}:${number}`, info)
            .then(data => {
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
                return data;
            });
    }

    static deletePullRequestInfo(owner, repo, number) {
        return redis.del(`${prefix}:${owner}:${repo}:${number}`)
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
        if (redis.enabled()) {
            return redis.keys(`${prefix}:${owner}`)
                .then(keys => Promise.all(keys.map(redis.del)))
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
        return Promise.resolve();
    }

    static enabled() {
        return redis.enabled();
    }
}

module.exports = PullRequestManager;
