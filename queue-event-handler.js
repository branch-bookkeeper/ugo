const postal = require('postal');
const Github = require('./github');
const redis = require('./redis');
const logger = require('./logger');
const { tail } = require('ramda');
const installationPrefix = 'installation';
const bookingPrefix = 'booking';

const addItem = ({ queue }) => {
    const [owner, repo, branch] = queue.split(':');

    Promise.all([
        _blockAllPullRequests(queue),
        redis.lrange(`${bookingPrefix}:${queue}`, 2),
    ])
        .then(([, queueItems]) => {
            if (queueItems.length > 0) {
                const [first] = queueItems;
                return Promise.all([
                    redis.get(`${installationPrefix}:${owner}:${repo}:${first.pullRequestNumber}`),
                    Promise.resolve(first),
                ]);
            }
            return Promise.resolve([null, null]);
        })
        .then(([installationData, first]) => {
            if (installationData) {
                return _unblockPullRequest({
                    ...installationData,
                    owner,
                    repo,
                    branch,
                    pullRequestNumber: first.pullRequestNumber,
                });
            }
            return Promise.resolve(null);
        })
        .catch(logger.error);
};

const removeItem = ({ queue, item }) => {
    const [owner, repo, branch] = queue.split(':');

    redis.get(`${installationPrefix}:${owner}:${repo}:${item.pullRequestNumber}`)
        .then(installationData => {
            if (installationData) {
                return _blockPullRequest({
                    ...installationData,
                    owner,
                    repo,
                    branch,
                    description: 'Book to merge',
                    pullRequestNumber: item.pullRequestNumber,
                });
            }
            return Promise.resolve(null);
        })
        .then(() => redis.lrange(`${bookingPrefix}:${queue}`, 1))
        .then(queueItems => {
            if (queueItems.length > 0) {
                const [first] = queueItems;
                return Promise.all([
                    redis.get(`${installationPrefix}:${owner}:${repo}:${first.pullRequestNumber}`),
                    Promise.resolve(first),
                ]);
            }
            return Promise.resolve([null, null]);
        })
        .then(([installationData, first]) => {
            if (installationData) {
                return _unblockPullRequest({
                    ...installationData,
                    owner,
                    repo,
                    branch,
                    pullRequestNumber: first.pullRequestNumber,
                });
            }
        })
        .catch(logger.error);
};

const _blockAllPullRequests = (queue) => {
    return redis.lrange(`${bookingPrefix}:${queue}`)
        .then(items => {
            const [owner, repo, branch] = queue.split(':');
            return Promise.all(tail(items).map((item, index) => {
                return redis.get(`${installationPrefix}:${owner}:${repo}:${item.pullRequestNumber}`)
                    .then(installationData => {
                        if (installationData) {
                            return _blockPullRequest({
                                ...installationData,
                                owner,
                                repo,
                                branch,
                                pullRequestNumber: item.pullRequestNumber,
                                description: `${index + 1} PR before you`,
                            });
                        }
                        return Promise.resolve(null);
                    });
            }));
        });
};

const _updatePullRequestStatus = (options) => {
    const {
        owner, repo, branch, pullRequestNumber,
    } = options;

    const targetUrl = `${process.env.APP_ORIGIN}/${owner}/${repo}/${branch}/${pullRequestNumber}`;

    return Github.updatePullRequestStatus({
        ...options,
        targetUrl,
    });
};

const _blockPullRequest = (options) => {
    return _updatePullRequestStatus({
        status: Github.STATUS_FAILURE,
        description: 'It\'s not your turn',
        ...options,
    });
};

const _unblockPullRequest = (options) => {
    return _updatePullRequestStatus({
        status: Github.STATUS_SUCCESS,
        description: 'It\'s your turn',
        ...options,
    });
};

postal.subscribe({
    channel: 'queue',
    topic: 'item.add',
    callback: addItem,
});

postal.subscribe({
    channel: 'queue',
    topic: 'item.remove',
    callback: removeItem,
});
