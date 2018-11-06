const postal = require('postal');
const { Client: OneSignalClient, Notification } = require('onesignal-node');
const { env: { ONESIGNAL_APP_ID, ONESIGNAL_KEY, SEND_DELAY = 60 } } = process;
const GitHub = require('./github');
const t = require('./manager-localization');
const onesignal = new OneSignalClient({ app: { appAuthKey: ONESIGNAL_KEY, appId: ONESIGNAL_APP_ID } });
const mongoManager = require('./manager-mongo');

const COLLECTION_NAME = 'pushNotification';
const TITLE_CHECKS_PASSED = t('notification.title.checks.passed');
const TITLE_CHECKS_FAILED = t('notification.title.checks.failed');
const TITLE_FIRST = t('notification.title.queue.first');
const NOTIFICATION_TYPE_CHECKS = 'checks';

const buildPullRequesturl = ({ owner, repo, pullRequestNumber }) => `https://github.com/${owner}/${repo}/pull/${pullRequestNumber}`;
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

const sendNotification = (options) => {
    const {
        title,
        message,
        username,
        owner,
        repo,
        pullRequestNumber,
        sendAt,
    } = options;

    const sendAfter = sendAt ? sendAt.toISOString() : undefined;
    const url = buildPullRequesturl({ owner, repo, pullRequestNumber });
    const notification = new Notification({
        send_after: sendAfter,
        contents: {
            en: message,
        },
        headings: {
            en: title,
        },
        url,
        filters: [
            {
                field: 'tag',
                key: 'username',
                relation: '=',
                value: username,
            },
        ],
    });

    return onesignal.sendNotification(notification)
        .then(({ data }) => {
            if (data.errors) {
                throw new Error(data.errors[0]);
            }
            postal.publish({
                channel: 'notification',
                topic: 'sent.ok',
                data,
            });
            return data;
        })
        .catch(err => postal.publish({
            channel: 'notification',
            topic: 'sent.ko',
            data: err,
        }));
};

const cancelNotification = id => getNotification(id)
    .then(notification => {
        if (notification) {
            return onesignal.cancelNotification(notification.id);
        } else {
            throw new Error('Notification not found on DB');
        }
    })
    .then(({ data }) => {
        data = JSON.parse(data);
        if (data.errors) {
            throw new Error(data.errors[0]);
        }
        postal.publish({
            channel: 'notification',
            topic: 'cancel.ok',
            data,
        });
    })
    .then(() => deleteNotification(id))
    .catch(err => postal.publish({
        channel: 'notification',
        topic: 'cancel.ko',
        data: err,
    }));

class PushNotificationManager {
    static sendFirstInQueueNotification(options) {
        const {
            owner,
            repo,
            pullRequestNumber,
            username,
        } = options;

        return sendNotification({
            title: TITLE_FIRST,
            message: t('notification.message.queue.first', { owner, repo, pullRequestNumber }),
            owner,
            repo,
            pullRequestNumber,
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

        const sendAt = new Date();
        sendAt.setSeconds(sendAt.getSeconds() + SEND_DELAY);

        const data = {
            title,
            message: t(message, { owner, repo, pullRequestNumber }),
            sendAt,
            owner,
            repo,
            pullRequestNumber,
            username,
            type: NOTIFICATION_TYPE_CHECKS,
        };

        return PushNotificationManager.cancelChecksNotification(options)
            .then(() => sendNotification(data))
            .then(res => saveNotification({
                ...res,
                ...data,
            }));
    }

    static cancelChecksNotification(options) {
        const {
            owner,
            repo,
            pullRequestNumber,
            username,
        } = options;

        const notificationId = getNotificationId({
            owner,
            repo,
            pullRequestNumber,
            username,
            type: NOTIFICATION_TYPE_CHECKS,
        });

        return cancelNotification(notificationId);
    }
}

postal.subscribe({
    channel: 'notification',
    topic: 'send.checks',
    callback: PushNotificationManager.sendChecksNotification,
});

postal.subscribe({
    channel: 'notification',
    topic: 'cancel.checks',
    callback: PushNotificationManager.cancelChecksNotification,
});

postal.subscribe({
    channel: 'notification',
    topic: 'send.queue.first',
    callback: PushNotificationManager.sendFirstInQueueNotification,
});

postal.subscribe({
    channel: 'notification',
    topic: 'sent.ok',
    callback: () => postal.publish({
        channel: 'metrics',
        topic: 'increment',
        data: {
            name: 'notification.sent.ok',
        },
    }),
});

postal.subscribe({
    channel: 'notification',
    topic: 'sent.ko',
    callback: () => postal.publish({
        channel: 'metrics',
        topic: 'increment',
        data: {
            name: 'notification.sent.ko',
        },
    }),
});

postal.subscribe({
    channel: 'notification',
    topic: 'cancel.ok',
    callback: () => postal.publish({
        channel: 'metrics',
        topic: 'increment',
        data: {
            name: 'notification.cancel.ok',
        },
    }),
});

postal.subscribe({
    channel: 'notification',
    topic: 'cancel.ko',
    callback: () => postal.publish({
        channel: 'metrics',
        topic: 'increment',
        data: {
            name: 'notification.cancel.ko',
        },
    }),
});

module.exports = PushNotificationManager;
