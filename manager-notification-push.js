const postal = require('postal');
const onesignal = require('simple-onesignal');
const logger = require('./logger');
const { env: { ONESIGNAL_APP_ID, ONESIGNAL_KEY, NODE_ENV } } = process;
const GitHub = require('./github');
const environment = NODE_ENV || 'production';
const development = environment === 'development';

onesignal.configure(ONESIGNAL_APP_ID, ONESIGNAL_KEY, development);

const TITLE_CHECKS_PASSED = 'All checks have passed';
const TITLE_CHECKS_FAILED = 'Some checks were not successful';
const TITLE_FIRST = 'You\'re first in queue';

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
            message: `${owner}/${repo} #${pullRequestNumber} is first in the queue`,
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
            ? `${owner}/${repo} #${pullRequestNumber} passed its checks`
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

PushNotificationManager.TITLE_CHECKS_PASSED = TITLE_CHECKS_PASSED;
PushNotificationManager.TITLE_CHECKS_FAILED = TITLE_CHECKS_FAILED;
PushNotificationManager.TITLE_FIRST = TITLE_FIRST;

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
