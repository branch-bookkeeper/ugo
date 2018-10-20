const mongoManager = require('../manager-mongo');
const GitHub = require('../github');
const pullRequestManager = require('../manager-pullrequest');
const { pluck } = require('ramda');
const {
    env: {
        OWNER: owner,
        REPO: repo,
        BRANCH: branch = 'master',
        APP_ID: appId,
    },
} = process;

if (!appId) {
    console.error('Specify APP_ID');
    process.exit(1);
}

if (!owner || !repo || !branch || !appId) {
    console.error('Specify owner repo and branch');
    process.exit(1);
}

mongoManager.getCollection('pullRequest')
    .then(collection => collection.find({
        owner,
        repo,
        branch,
    }))
    .then(cursor => cursor.toArray())
    .then(items => Promise.all(items.map(({
        owner,
        repo,
        pullRequestNumber,
        installationId,
    }) => GitHub.getPullRequestInfo(owner, repo, pullRequestNumber, installationId)
        .then(pullRequest => {
            const {
                statuses_url: statusUrl,
                title,
                html_url: humanUrl,
                assignees,
                number: pullRequestNumber,
                base: { repo: baseRepo, ref: branch },
                user: { login: author },
            } = pullRequest;
            const { owner: { login: owner }, name: repo } = baseRepo;

            return pullRequestManager.setPullRequestInfo(owner, repo, pullRequestNumber, {
                statusUrl,
                installationId,
                pullRequestNumber,
                title,
                author,
                humanUrl,
                branch,
                assignees: pluck('login', assignees),
            });
        }))))
    .then(process.exit)
    .catch(console.error);
