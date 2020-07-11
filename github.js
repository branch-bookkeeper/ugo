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
    pathEq,
    compose,
} = require('ramda');
const request = require('request-promise-native').defaults({ json: true, resolveWithFullResponse: true });
const RequestAllPages = require('request-all-pages');
const postal = require('postal');
const t = require('./manager-localization');
const {
    env: {
        GITHUB_BASE_HOST: baseHost = 'https://api.github.com',
        APP_ID: appId,
        NODE_ENV: environment = 'production',
        PRIVATE_KEY: privateKey,
        APP_ORIGIN: appBaseHost,
    },
} = process;
const development = environment === 'development';

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

const getRequestOptions = (token, accept = 'application/json', body) => ({
    headers: {
        'user-agent': 'branch-bookkeeper',
        authorization: token ? `token ${token}` : undefined,
        accept,
    },
    body,
});

const getCheckRunBody = ({
    sha,
    status,
    description,
    actions,
    owner,
    repo,
    branch,
    pullRequestNumber,
}) => ({
    name: t('checkRun.name'),
    head_sha: sha,
    details_url: `${appBaseHost}/${owner}/${repo}/${branch}/${pullRequestNumber}`,
    conclusion: status,
    started_at: (new Date()).toISOString(),
    completed_at: (new Date()).toISOString(),
    output: {
        title: description,
        summary: t('checkRun.summary', { owner, repo, branch }),
    },
    actions,
});

const getCombinedStatus = ([githubSuitesResponse, githubStatusResponse]) => {
    const githubConclusions = pluck('conclusion', pathOr([], ['check_suites'], githubSuitesResponse));
    const githubStatus = pathOr('', ['state'], githubStatusResponse);

    const conclusionsHasPending = not(isEmpty(filter(isNil, githubConclusions)));
    const conclusionsIsSuccess = isEmpty(reject(equals(GitHub.CHECK_SUITE_CONCLUSION_SUCCESS), githubConclusions));
    const conclusionsHasFailure = not(isEmpty(filter(equals(GitHub.CHECK_SUITE_CONCLUSION_FAILURE), githubConclusions)));

    const statusIsPending = equals(GitHub.STATUS_PENDING, githubStatus);
    const statusIsSuccess = equals(GitHub.STATUS_SUCCESS, githubStatus);
    const statusIsFailure = equals(GitHub.STATUS_FAILURE, githubStatus);

    if (conclusionsHasPending || statusIsPending) {
        return GitHub.STATUS_PENDING;
    }
    if (conclusionsHasFailure || statusIsFailure) {
        return GitHub.STATUS_FAILURE;
    }
    if (conclusionsIsSuccess && statusIsSuccess) {
        return GitHub.STATUS_SUCCESS;
    }

    return GitHub.STATUS_SUCCESS;
};

const getInstallationAccessToken = installationId => {
    const token = development ? '' : JWT.sign({
        iat: Math.floor(Date.now() / 1000),
        exp: (Math.floor(Date.now() / 1000) + (10 * 60)),
        iss: appId,
    }, privateKey, { algorithm: 'RS256' });

    return request.post(`${baseHost}/app/installations/${installationId}/access_tokens`, {
        ...getRequestOptions(null, 'application/vnd.github.machine-man-preview+json'),
        auth: {
            bearer: token,
        },
    })
        .then(path(['body', 'token']));
};

const getCheckRunsForSha = ({
    installationId,
    owner,
    repo,
    sha,
}) => getInstallationAccessToken(installationId)
    .then(accessToken => request.get(
        `${baseHost}/repos/${owner}/${repo}/commits/${sha}/check-runs`,
        getRequestOptions(accessToken, 'application/vnd.github.antiope-preview+json')
    ))
    .then(trackApiUsageAndReturnBody)
    .then(compose(
        filter(pathEq(['app', 'id'], Number(appId))),
        path(['check_runs'])
    ))
    .catch(() => []);

const createCheckRunForSha = options => getInstallationAccessToken(options.installationId)
    .then(accessToken => request.post(
        `${baseHost}/repos/${options.owner}/${options.repo}/check-runs`,
        getRequestOptions(accessToken, 'application/vnd.github.antiope-preview+json', getCheckRunBody(options))
    ))
    .then(trackApiUsageAndReturnBody);

const updateCheckRun = options => getInstallationAccessToken(options.installationId)
    .then(accessToken => request.patch(
        `${baseHost}/repos/${options.owner}/${options.repo}/check-runs/${options.checkRunId}`,
        getRequestOptions(accessToken, 'application/vnd.github.antiope-preview+json', getCheckRunBody(options))
    ))
    .then(trackApiUsageAndReturnBody)
    .catch(() => {});

class GitHub {
    static createCheckRunForPullRequest(options) {
        return getCheckRunsForSha(options)
            .then(checkRuns => {
                options = {
                    ...options,
                    checkRunId: path([0, 'id'], checkRuns),
                };
                return isEmpty(checkRuns) ? createCheckRunForSha(options) : updateCheckRun(options);
            });
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

    static getHashCombinedStatus({
        installationId,
        owner,
        repo,
        sha,
    }) {
        return Promise.all([
            GitHub.getHashCheckSuites({
                installationId,
                owner,
                repo,
                sha,
            }),
            GitHub.getHashStatus({
                installationId,
                owner,
                repo,
                sha,
            }),
        ])
            .then(getCombinedStatus);
    }
}

GitHub.STATUS_SUCCESS = 'success';
GitHub.STATUS_FAILURE = 'failure';
GitHub.STATUS_ERROR = 'error';
GitHub.STATUS_PENDING = 'pending';

GitHub.CHECK_SUITE_CONCLUSION_SUCCESS = 'success';
GitHub.CHECK_SUITE_CONCLUSION_FAILURE = 'failure';
GitHub.CHECK_SUITE_CONCLUSION_NEUTRAL = 'neutral';
GitHub.CHECK_SUITE_CONCLUSION_CANCELLED = 'cancelled';
GitHub.CHECK_SUITE_CONCLUSION_TIMED_OUT = 'timed_out';
GitHub.CHECK_SUITE_CONCLUSION_ACTION_REQUIRED = 'action_required';

module.exports = GitHub;
