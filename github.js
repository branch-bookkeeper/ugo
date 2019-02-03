const JWT = require('jsonwebtoken');
const {
    map,
    path,
    last,
    flatten,
    isEmpty,
    reject,
    equals,
    not,
    isNil,
    filter,
    pathOr,
    pluck,
} = require('ramda');
const request = require('request-promise-native').defaults({ json: true, resolveWithFullResponse: true });
const RequestAllPages = require('request-all-pages');
const postal = require('postal');
const GITHUB_DEFAULT_BASE_HOST = 'https://api.github.com';
const {
    env: {
        GITHUB_BASE_HOST: baseHost = GITHUB_DEFAULT_BASE_HOST,
        APP_ID: appId,
        NODE_ENV: environment = 'production',
        PRIVATE_KEY: privateKey,
    },
} = process;
const development = environment === 'development';

const updateBaseHost = url => url.replace(GITHUB_DEFAULT_BASE_HOST, baseHost);

const requestAllPages = opts => new Promise((resolve, reject) => RequestAllPages(opts, { perPage: 100 }, (err, pages) => err ? reject(err) : resolve(pages)));

const trackRateLimit = remaining => postal.publish({
    channel: 'metrics',
    topic: 'gauge',
    data: {
        name: 'github.api.ratelimit',
        value: remaining,
    },
});

const trackApiRequest = (value = 1) => postal.publish({
    channel: 'metrics',
    topic: 'increment',
    data: {
        name: 'github.api.request',
        value,
    },
});

const trackApiUsageAndReturnBody = response => {
    trackRateLimit(path(['x-ratelimit-remaining'], response.headers));
    trackApiRequest();
    return {
        ...response.body,
        client_id: path(['x-oauth-client-id'], response.headers),
    };
};

const getRequestOptions = (token, accept) => ({
    headers: {
        'user-agent': 'branch-bookkeeper',
        authorization: token ? `token ${token}` : undefined,
        accept,
    },
});

const getCombinedStatus = ([githubSuitesResponse, githubStatusResponse]) => {
    const githubConclusions = pluck('conclusion', pathOr([], ['check_suites'], githubSuitesResponse));
    const githubStatus = pathOr('', ['state'], githubStatusResponse);

    const conclusionsHasPending = not(isEmpty(filter(isNil, githubConclusions)));
    const conclusionsIsSuccess = isEmpty(reject(equals(Github.CHECK_SUITE_CONCLUSION_SUCCESS), githubConclusions));
    const conclusionsHasFailure = not(isEmpty(filter(equals(Github.CHECK_SUITE_CONCLUSION_FAILURE), githubConclusions)));

    const statusIsPending = equals(Github.STATUS_PENDING, githubStatus);
    const statusIsSuccess = equals(Github.STATUS_SUCCESS, githubStatus);
    const statusIsFailure = equals(Github.STATUS_FAILURE, githubStatus);

    if (conclusionsHasPending || statusIsPending) {
        return Github.STATUS_PENDING;
    }
    if (conclusionsHasFailure || statusIsFailure) {
        return Github.STATUS_FAILURE;
    }
    if (conclusionsIsSuccess && statusIsSuccess) {
        return Github.STATUS_SUCCESS;
    }

    return Github.STATUS_SUCCESS;
};

const getInstallationAccessToken = installationId => {
    const token = development ? '' : JWT.sign({
        iat: Math.floor(Date.now() / 1000),
        exp: (Math.floor(Date.now() / 1000) + (10 * 60)),
        iss: appId,
    }, privateKey, { algorithm: 'RS256' });

    return request.post(`${baseHost}/installations/${installationId}/access_tokens`, {
        ...getRequestOptions(null, 'application/vnd.github.machine-man-preview+json'),
        auth: {
            bearer: token,
        },
    })
        .then(path(['body', 'token']));
};

class Github {
    static updatePullRequestStatus({
        installationId,
        statusUrl,
        status,
        description,
        targetUrl,
    }) {
        return getInstallationAccessToken(installationId)
            .then(accessToken => request.post(updateBaseHost(statusUrl), {
                ...getRequestOptions(accessToken),
                body: {
                    state: status,
                    description: description,
                    target_url: targetUrl,
                    context: 'Branch Bookkeeper',
                },
            })
                .then(trackApiUsageAndReturnBody));
    }

    static getUserInfo(token) {
        return request.get(`${baseHost}/user`, getRequestOptions(token))
            .then(trackApiUsageAndReturnBody);
    }

    static getInstallationInfo(token, installationId) {
        return requestAllPages({
            uri: `${baseHost}/user/installations/${installationId}/repositories`,
            json: true,
            ...getRequestOptions(token, 'application/vnd.github.machine-man-preview+json'),
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
            .then(accessToken => request.get(`${baseHost}/repos/${owner}/${repo}/pulls/${number}`, {
                ...getRequestOptions(accessToken),
                resolveWithFullResponse: false,
            }));
    }

    static getHashStatus({
        installationId,
        owner,
        repo,
        sha,
    }) {
        return getInstallationAccessToken(installationId)
            .then(accessToken => request.get(
                `${baseHost}/repos/${owner}/${repo}/commits/${sha}/status`,
                getRequestOptions(accessToken)
            ))
            .then(trackApiUsageAndReturnBody)
            .catch(() => {});
    }

    static getHashCheckSuites({
        installationId,
        owner,
        repo,
        sha,
    }) {
        return getInstallationAccessToken(installationId)
            .then(accessToken => request.get(
                `${baseHost}/repos/${owner}/${repo}/commits/${sha}/check-suites`,
                getRequestOptions(accessToken, 'application/vnd.github.antiope-preview+json')
            ))
            .then(trackApiUsageAndReturnBody)
            .catch(() => {});
    }
}

Github.STATUS_SUCCESS = 'success';
Github.STATUS_FAILURE = 'failure';
Github.STATUS_ERROR = 'error';
Github.STATUS_PENDING = 'pending';

Github.CHECK_SUITE_CONCLUSION_SUCCESS = 'success';
Github.CHECK_SUITE_CONCLUSION_FAILURE = 'failure';
Github.CHECK_SUITE_CONCLUSION_NEUTRAL = 'neutral';
Github.CHECK_SUITE_CONCLUSION_CANCELLED = 'cancelled';
Github.CHECK_SUITE_CONCLUSION_TIMED_OUT = 'timed_out';
Github.CHECK_SUITE_CONCLUSION_ACTION_REQUIRED = 'action_required';

module.exports = Github;
