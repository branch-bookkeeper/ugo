const JWT = require('jsonwebtoken');
const {
    prop,
    map,
    path,
    head,
    flatten,
} = require('ramda');
const request = require('request-promise-native').defaults({ json: true });
const RequestAllPages = require('request-all-pages');
const userAgent = 'branch-bookkeeper';

const requestAllPages = (opts) => {
    return new Promise((resolve, reject) => {
        RequestAllPages(opts, { perPage: 100 }, (err, pages) => err ? reject(err) : resolve(pages));
    });
};

const getInstallationAccessToken = installationId => {
    const token = JWT.sign({
        iat: Math.floor(Date.now() / 1000),
        exp: (Math.floor(Date.now() / 1000) + (10 * 60)),
        iss: process.env.APP_ID,
    }, process.env.PRIVATE_KEY, { algorithm: 'RS256' });

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
        return getInstallationAccessToken(options.installationId)
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
        return requestAllPages({
            uri: `https://api.github.com/user/installations/${installationId}/repositories`,
            json: true,
            headers: {
                'user-agent': userAgent,
                authorization: `token ${token}`,
                accept: 'application/vnd.github.machine-man-preview+json',
            },
        })
            .then(response => {
                const firstPage = head(response);
                return {
                    total_count: path(['body', 'total_count'], firstPage),
                    repositories: flatten(map(path(['body', 'repositories']), response)),
                    client_id: path(['headers', 'x-oauth-client-id'], firstPage),
                };
            });
    }
}

Github.STATUS_SUCCESS = 'success';
Github.STATUS_FAILURE = 'failure';

module.exports = Github;
