const JWT = require('jsonwebtoken');
const { prop } = require('ramda');
const request = require('request-promise').defaults({ json: true });
const fs = require('fs');
const postal = require('postal');
const logger = require('./logger');
const userAgent = 'branch-bookkeeper';
let privateKey = '';

const getInstallationAccessToken = (appId, privateKey, installationId) => {
    if (privateKey === '') {
        return Promise.reject(new Error('Missing private key'));
    }

    const token = JWT.sign({
        iat: Math.floor(Date.now() / 1000),
        exp: (Math.floor(Date.now() / 1000) + (10 * 60)),
        iss: appId,
    }, privateKey, { algorithm: 'RS256' });

    return request.post(`https://api.github.com/installations/${installationId}/access_tokens`, {
        auth: {
            bearer: token,
        },
        headers: {
            'user-agent': userAgent,
            accept: 'application/vnd.github.machine-man-preview+json',
        },
    }).then(prop('token'));
};

const readPrivateKey = ({ path: privateKeyPath }) => {
    privateKey = fs.readFileSync(privateKeyPath);
    logger.info(`${ privateKeyPath } saved`);
};

postal.subscribe({
    channel: 'github',
    topic: 'key.saved',
    callback: readPrivateKey,
});

class Github {
    static updatePullRequestStatus(options) {
        return Github.getInstallationAccessToken(options.installationId)
            .then(accessToken => {
                return request.post(options.statusUrl, {
                    headers: {
                        'user-agent': userAgent,
                        authorization: `token ${accessToken}`,
                    },
                    body: {
                        state: options.status,
                        description: options.description,
                        target_url: options.targetUrl,
                        context: 'Branch Bookkeeper',
                    },
                });
            });
    }

    static getInstallationAccessToken(installationId) {
        return getInstallationAccessToken(process.env.APP_ID, privateKey, installationId);
    }

    static getUserInfo(token) {
        return request.get('https://api.github.com/user', {
            headers: {
                'user-agent': userAgent,
                authorization: `token ${token}`,
            },
            resolveWithFullResponse: true,
        })
            .then(response => {
                return {
                    ...response.body,
                    client_id: response.headers['x-oauth-client-id'],
                };
            });
    }

    static getInstallationInfo(token, installationId) {
        return request.get(`https://api.github.com/user/installations/${installationId}/repositories`, {
            headers: {
                'user-agent': userAgent,
                authorization: `token ${token}`,
                accept: 'application/vnd.github.machine-man-preview+json',
            },
            resolveWithFullResponse: true,
        })
            .then(response => {
                return {
                    ...response.body,
                    client_id: response.headers['x-oauth-client-id'],
                };
            });
    }
}

Github.STATUS_SUCCESS = 'success';
Github.STATUS_FAILURE = 'failure';

module.exports = Github;
