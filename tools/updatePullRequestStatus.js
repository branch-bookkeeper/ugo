const pullRequestHandler = require('./handler-pullrequest');

const owner = process.env.OWNER;
const repo = process.env.REPO;
const branch = process.env.BRANCH || 'master';
const appId = process.env.APP_ID;

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
