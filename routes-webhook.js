const router = require('express').Router();
const redis = require('./redis');
const Github = require('./github');
const createError = require('http-errors');
const prefix = 'booking';

router.use('/', (req, res, next) => {
    if (!redis.enabled()) {
        next(createError.ServiceUnavailable('redis not available'));
        return;
    }
    next();
});

// Installation
router.post('/', (req, res, next) => {
    if (req.get('X-GitHub-Event') !== 'installation') {
        next();
        return;
    }
});

// PR
router.post('/', (req, res, next) => {
    if (req.get('X-GitHub-Event') !== 'pull_request') {
        next();
        return;
    }

    const body = req.body;
    const { installation: { id: installationId } } = body;
    const { pull_request: pullRequest } = body;
    const { statuses_url: url } = pullRequest;
    const { base: { repo: baseRepo } } = pullRequest;
    const { base: { ref: branch } } = pullRequest;
    const { number: pullRequestNumber } = pullRequest;
    const { owner: { login: owner } } = baseRepo;
    const { name: repo } = baseRepo;

    Promise.all([
        redis.lrange(`${prefix}:${owner}:${repo}:${branch}`),
        Github.getInstallationAccessToken(installationId)
    ])
    .then(([data, accessToken]) => {
        let status = Github.STATUS_SUCCESS;

        if(data.length === 0) {
            status = Github.STATUS_FAILURE;
        } else if (data[0].pullRequestNumber === pullRequestNumber) {
            status = Github.STATUS_SUCCESS;
        }

        const options = {
            accessToken,
            url,
            status,
            description: status === Github.STATUS_SUCCESS ? 'It\'s your turn. Go go go!' : `There are ${data.length} people before you`,
        };

        return Github.updatePullRequestStatus(options)
    })
    .then(() => res.send(''))
    .catch(next)
});

// Catch all
router.all('/', (req, res) => res.send(''));

module.exports = router;
