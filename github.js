const JWT = require('jsonwebtoken');
const {
    map,
    path,
    last,
    flatten,
} = require('ramda');
const request = require('request-promise-native').defaults({ json: true, resolveWithFullResponse: true });
const RequestAllPages = require('request-all-pages');
const postal = require('postal');
const userAgent = 'branch-bookkeeper';

const requestAllPages = (opts) => {
    return new Promise((resolve, reject) => {
        RequestAllPages(opts, { perPage: 100 }, (err, pages) => err ? reject(err) : resolve(pages));
    });
};

const trackRateLimit = remaining => {
    postal.publish({
        channel: 'metrics',
        topic: 'gauge',
        data: {
            name: 'github.api.ratelimit',
            value: remaining,
        },
    });
};

const trackApiRequest = (value = 1) => {
    postal.publish({
        channel: 'metrics',
        topic: 'increment',
        data: {
            name: 'github.api.request',
            value,
        },
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
    }).then(path(['body', 'token']));
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
                })
                    .then(response => {
                        trackRateLimit(path(['x-ratelimit-remaining'], response.headers));
                        trackApiRequest();
                        return response.body;
                    });
            });
    }

    static getUserInfo(token) {
        return request.get('https://api.github.com/user', {
            headers: {
                'user-agent': userAgent,
                authorization: `token ${token}`,
            },
        })
            .then(response => {
                trackRateLimit(path(['x-ratelimit-remaining'], response.headers));
                trackApiRequest();
                return {
                    ...response.body,
                    client_id: path(['x-oauth-client-id'], response.headers),
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
                const lastPage = last(response);
                trackRateLimit(path(['headers', 'x-ratelimit-remaining'], lastPage));
                trackApiRequest(response.length);
                return {
                    total_count: path(['body', 'total_count'], lastPage),
                    repositories: flatten(map(path(['body', 'repositories']), response)),
                    client_id: path(['headers', 'x-oauth-client-id'], lastPage),
                };
            });
    }

    static getPullRequestInfo(owner, repo, number, installationId) {
        return getInstallationAccessToken(installationId)
            .then(accessToken => request.get(`https://api.github.com/repos/${owner}/${repo}/pulls/${number}`, {
                headers: {
                    'user-agent': userAgent,
                    authorization: `token ${accessToken}`,
                },
                resolveWithFullResponse: false,
            }));
    }
}

Github.STATUS_SUCCESS = 'success';
Github.STATUS_FAILURE = 'failure';

module.exports = Github;
