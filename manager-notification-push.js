const postal = require('postal');
const onesignal = require('simple-onesignal');
const logger = require('./logger');
const environment = process.env['NODE_ENV'] || 'production';
const development = environment === 'development';

onesignal.configure(process.env.ONESIGNAL_APP_ID, process.env.ONESIGNAL_KEY, development);

const _buildPullRequesturl = ({ owner, repo, pullRequestNumber }) => `https://github.com/${owner}/${repo}/pull/${pullRequestNumber}`;

class PushNotificationManager {
    static sendRebasedNotification(options) {
        const {
            owner,
            repo,
            branch,
            pullRequestNumber,
            username,
        } = options;

        return PushNotificationManager._sendNotification({
            ...options,
            title: 'Your PR can be rebased',
            message: `${owner}/${repo} #${pullRequestNumber} can be rebased from ${branch}`,
            url: _buildPullRequesturl({ owner, repo, pullRequestNumber }),
            username,
        });
    }

    static sendMergedNotification(options) {
        const {
            owner,
            repo,
            branch,
            pullRequestNumber,
            username,
        } = options;

        return PushNotificationManager._sendNotification({
            ...options,
            title: 'All checks passed',
            message: `${owner}/${repo} #${pullRequestNumber} can be merged on ${branch}`,
            url: `https://github.com/${owner}/${repo}/pull/${pullRequestNumber}`,
            username,
        });
    }

    static _sendNotification(options) {
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
    }
}

postal.subscribe({
    channel: 'notification',
    topic: 'send.merged',
    callback: PushNotificationManager.sendMergedNotification,
});

postal.subscribe({
    channel: 'notification',
    topic: 'send.rebased',
    callback: PushNotificationManager.sendRebasedNotification,
});

module.exports = PushNotificationManager;
