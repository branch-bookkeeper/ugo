const postal = require('postal');
const onesignal = require('simple-onesignal');
const logger = require('./logger');
const GitHub = require('./github');
const environment = process.env['NODE_ENV'] || 'production';
const development = environment === 'development';

onesignal.configure(process.env.ONESIGNAL_APP_ID, process.env.ONESIGNAL_KEY, development);

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
    static sendRebasedNotification(options) {
        const {
            owner,
            repo,
            branch,
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
            branch,
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
    topic: 'send.rebased',
    callback: PushNotificationManager.sendRebasedNotification,
});

module.exports = PushNotificationManager;
