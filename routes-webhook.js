const router = require('express').Router();
const Github = require('./github');
const createError = require('http-errors');
const { findIndex, propEq, find } = require('ramda');
const manager = require('./manager-queue');
const installationManager = require('./manager-installation');
const pullRequestManager = require('./manager-pullrequest');

router.post('/', (req, res, next) => {
    if (!pullRequestManager.enabled()) {
        next(createError.ServiceUnavailable('queue not available'));
        return;
    }

    const { sender: { login: username } } = req.body;

    req.username = username;
    next();
});

// PR
router.post('/', (req, res, next) => {
    if (req.get('X-GitHub-Event') !== 'pull_request') {
        next();
        return;
    }

    const { action } = req.body;

    if (action === 'closed') {
        _handleClosed(req, res, next);
    } else {
        _handleOpened(req, res, next);
    }
});

const _handleClosed = (req, res, next) => {
    const body = req.body;
    const { pull_request: pullRequest } = body;
    const { base: { repo: baseRepo, ref: branch } } = pullRequest;
    const { number: pullRequestNumber } = pullRequest;
    const { owner: { login: owner } } = baseRepo;
    const { name: repo } = baseRepo;

    manager.getItems(`${owner}:${repo}:${branch}`)
        .then(bookingData => {
            const item = find(propEq('pullRequestNumber', pullRequestNumber))(bookingData);
            if (item) {
                return manager.removeItem(`${owner}:${repo}:${branch}`, item);
            }
        })
        .then(() => pullRequestManager.deletePullRequestInfo(owner, repo, pullRequestNumber))
        .then(() => res.send(`PR ${owner}/${repo}/${branch} #${pullRequestNumber} closed`))
        .catch(next);
};

const _handleOpened = (req, res, next) => {
    const body = req.body;
    const { installation: { id: installationId } } = body;
    const { pull_request: pullRequest } = body;
    const { statuses_url: statusUrl } = pullRequest;
    const { base: { repo: baseRepo, ref: branch } } = pullRequest;
    const { number: pullRequestNumber } = pullRequest;
    const { owner: { login: owner } } = baseRepo;
    const { name: repo } = baseRepo;
    let status;
    let description;
    let targetUrl;

    pullRequestManager.setPullRequestInfo(owner, repo, pullRequestNumber, {
        statusUrl,
        installationId,
    })
        .then(() => installationManager.setInstallationId(owner, repo, installationId))
        .then(() => manager.getItems(`${owner}:${repo}:${branch}`))
        .then(bookingData => {
            targetUrl = `${process.env.APP_ORIGIN}/${owner}/${repo}/${branch}/${pullRequestNumber}`;
            const index = findIndex(propEq('pullRequestNumber', pullRequestNumber))(bookingData);

            if (bookingData.length === 0 || index < 0) {
                description = 'Book to merge';
                status = Github.STATUS_FAILURE;
            } else if (index === 0) {
                description = 'It\'s your turn';
                status = Github.STATUS_SUCCESS;
            } else {
                description = `${index} PR before you`;
                status = Github.STATUS_FAILURE;
            }

            return Github.updatePullRequestStatus({
                installationId,
                statusUrl,
                status,
                description,
                targetUrl,
            });
        })
        .then(() => res.json({
            pullRequestNumber,
            status,
            description,
            targetUrl,
        }))
        .catch(next);
};

// Catch all
router.all('/', (req, res) => res.send(''));

module.exports = router;
