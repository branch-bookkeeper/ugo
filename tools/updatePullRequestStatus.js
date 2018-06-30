const pullRequestHandler = require('../handler-pullrequest');
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

pullRequestHandler
    .setAllPullRequestsStatuses(owner, repo, branch)
    .then(process.exit)
    .catch(console.error);
