const postal = require('postal');
const onesignal = require('simple-onesignal');
const logger = require('./logger');
const { env: { ONESIGNAL_APP_ID, ONESIGNAL_KEY, NODE_ENV } } = process;
const GitHub = require('./github');
const environment = NODE_ENV || 'production';
const development = environment === 'development';

onesignal.configure(ONESIGNAL_APP_ID, ONESIGNAL_KEY, development);

const buildPullRequesturl = ({ owner, repo, pullRequestNumber }) => `https://github.com/${owner}/${repo}/pull/${pullRequestNumber}`;

const sendNotification = (options) => {
    const {
        title,
        message,
        username,
        url,
    } = options;

    return new Promise((resolve, reject) => {
        onesignal.sendMessage({
            contents: {
                en: message,
            },
            headings: {
                en: title,
            },
            url: url,
            filters: [
                {
                    field: 'tag',
                    key: 'username',
                    relation: '=',
                    value: username,
                },
            ],
        }, (err, data) => {
            if (err && err.length > 0) {
                logger.error(err, data);
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
};

class PushNotificationManager {
    static sendFirstInQueueNotification(options) {
        const {
            owner,
            repo,
            pullRequestNumber,
            username,
        } = options;

        return sendNotification({
            ...options,
            title: 'Your PR can be rebased',
            message: `${owner}/${repo} #${pullRequestNumber} can be rebased from ${branch}`,
            url: buildPullRequesturl({ owner, repo, pullRequestNumber }),
            username,
        });
    }

    static sendChecksNotification(options) {
        const {
            owner,
            repo,
            pullRequestNumber,
            username,
            state,
        } = options;

        const title = state === GitHub.STATUS_SUCCESS
            ? 'All checks have passed'
            : 'Some checks were not successful';
        const message = state === GitHub.STATUS_SUCCESS
            ? `${owner}/${repo} #${pullRequestNumber} can be merged into ${branch}`
            : `${owner}/${repo} #${pullRequestNumber} failed its checks`;

        return sendNotification({
            ...options,
            title,
            message,
            url: buildPullRequesturl({ owner, repo, pullRequestNumber }),
            username,
        });
    }
}

postal.subscribe({
    channel: 'notification',
    topic: 'send.checks',
    callback: PushNotificationManager.sendChecksNotification,
});

postal.subscribe({
    channel: 'notification',
    topic: 'send.queue.first',
    callback: PushNotificationManager.sendFirstInQueueNotification,
});

module.exports = PushNotificationManager;
