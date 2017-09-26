const postal = require('postal');
const request = require('request-promise');
const fs = require('fs');
const logger = require('./logger');

const privateKeyPath = 'private.key';

const downloadPrivateKey = () => {
    if (process.env.PRIVATE_KEY_URL !== undefined) {
        request.get(process.env.PRIVATE_KEY_URL)
            .then(res => fs.writeFile(privateKeyPath, res, () => {
                postal.publish({
                    channel: 'github',
                    topic: 'key.saved',
                    data: {
                        path: privateKeyPath,
                    },
                });
            }));
    } else {
        postal.publish({
            channel: 'github',
            topic: 'key.not_available',
        });
    }
};

postal.subscribe({
    channel: 'application',
    topic: 'started',
    callback: downloadPrivateKey,
});

postal.subscribe({
    channel: 'application',
    topic: 'started',
    callback: (data) => {
        logger.info(`ugo started on port ${data.port}`);
    },
});
