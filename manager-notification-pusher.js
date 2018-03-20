const Pusher = require('pusher');
const postal = require('postal');
const { env: { PUSHER_APP_ID: appId, PUSHER_KEY: key, PUSHER_SECRET: secret } } = process;
const pusher = new Pusher({ appId, key, secret });

const _getChannelId = (owner, repo, branch) => `${owner}-${repo}-${branch}`;

class PusherNotificationManager {
    static sendQueueUpdate({
        owner,
        repo,
        branch,
        items,
    }) {
        pusher.trigger(_getChannelId(owner, repo, branch), 'queue.update', items);
    }

    static getChannelId(owner, repo, branch) {
        return _getChannelId(owner, repo, branch);
    }
}


postal.subscribe({
    channel: 'notification',
    topic: 'send.update',
    callback: PusherNotificationManager.sendQueueUpdate,
});

module.exports = PusherNotificationManager;
