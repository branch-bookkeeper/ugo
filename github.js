const JWT = require('jsonwebtoken');
const { prop } = require('ramda');
const request = require('request-promise').defaults({ json: true });
const fs = require('fs');
const userAgent = 'ugo';
const privateKeyPath = 'private.key';

if (process.env.PRIVATE_KEY_URL !== undefined) {
    request.get(process.env.PRIVATE_KEY_URL)
        .then(res => fs.writeFile(privateKeyPath, res, () => console.log(`${privateKeyPath} saved`)));
}

const getInstallationAccessToken = (appId, privateKey, installationId) => {
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

class Github {
    static updatePullRequestStatus(options) {
        return request.post(options.statusUrl, {
            headers: {
                'user-agent': userAgent,
                authorization: `token ${options.accessToken}`,
            },
            body: {
                state: options.status,
                description: options.description,
                target_url: options.targetUrl,
                context: 'Branch Bookkeeper',
            },
        });
    }

    static getInstallationAccessToken(installationId) {
        return getInstallationAccessToken(process.env.APP_ID, fs.readFileSync(privateKeyPath), installationId);
    }
}

Github.STATUS_SUCCESS = 'success';
Github.STATUS_FAILURE = 'failure';

module.exports = Github;