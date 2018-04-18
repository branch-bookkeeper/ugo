const postal = require('postal');
const onesignal = require('simple-onesignal');
const logger = require('./logger');
const { env: { ONESIGNAL_APP_ID, ONESIGNAL_KEY, NODE_ENV: environment = 'production' } } = process;
const GitHub = require('./github');
const t = require('./manager-localization');
const development = environment === 'development';

onesignal.configure(ONESIGNAL_APP_ID, ONESIGNAL_KEY, development);

const TITLE_CHECKS_PASSED = t('notification.title.checks.passed');
const TITLE_CHECKS_FAILED = t('notification.title.checks.failed');
const TITLE_FIRST = t('notification.title.queue.first');

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
            title: TITLE_FIRST,
            message: t('notification.message.queue.first', { owner, repo, pullRequestNumber }),
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
            ? TITLE_CHECKS_PASSED
            : TITLE_CHECKS_FAILED;
        const message = state === GitHub.STATUS_SUCCESS
            ? 'notification.message.checks.passed'
            : 'notification.message.checks.failed';

        return sendNotification({
            ...options,
            title,
            message: t(message, { owner, repo, pullRequestNumber }),
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
