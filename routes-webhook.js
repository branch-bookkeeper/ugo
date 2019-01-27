const router = require('express').Router();
const createError = require('http-errors');
const installationManager = require('./manager-installation');
const installationInfoManager = require('./manager-installation-info');
const pullRequestManager = require('./manager-pullrequest');
const pullRequestHandler = require('./handler-pullrequest');
const queueManager = require('./manager-queue');
const logger = require('./logger');
const validator = require('./validator-signature-github');

// Validator
router.post('/', validator);

// Service availability
router.post('/', (req, res, next) => {
    if (!pullRequestManager.enabled()) {
        return next(createError.ServiceUnavailable('Queue not available'));
    }
    next();
});

// Username
router.post('/', (req, res, next) => {
    const { body: { sender: { login: username } } } = req;

    req.user = { username };
    req.event = req.get('X-GitHub-Event');
    next();
});

// Statuses
router.post('/', (req, res, next) => {
    if (req.event !== 'status') {
        return next();
    }

    const { body: { state, sha, repository: { name: repo, owner: { login: owner } } } } = req;

    pullRequestHandler.handleStatusChange({
        owner,
        repo,
        sha,
    })
        .then(() => res.json(`Status of ${sha} ${state}`));
});

// Repositories
router.post('/', (req, res, next) => {
    if (req.event !== 'repository') {
        return next();
    }

    const { body: { repository: { owner: { login: owner } } } } = req;

    // Installation info are deleted also on repo creation because they're obsolete
    // So there's no need to check the action present in the body
    installationManager.getInstallationId(owner)
        .then(installationInfoManager.deleteInstallationInfos)
        .then(() => res.json(`Installation infos of ${owner} deleted`));
});

// PR
router.post('/', (req, res, next) => {
    if (req.event !== 'pull_request') {
        return next();
    }

    const { body: { action, installation: { id: installationId }, pull_request: pullRequest } } = req;

    let pendingPromise;

    if (action === 'closed') {
        pendingPromise = pullRequestHandler.handleClosed(pullRequest);
    } else if (action === 'opened') {
        pendingPromise = pullRequestHandler.handleOpened(pullRequest, installationId);
    } else {
        pendingPromise = pullRequestHandler.handleSync(pullRequest, installationId);
    }

    pendingPromise
        .then(({
            owner,
            repo,
            branch,
            pullRequestNumber,
        }) => res.json(`PR ${owner}/${repo}/${branch} #${pullRequestNumber} ${action}`))
        .catch(error => {
            logger.error(error);
            next(error);
        });
});

// Installation
router.post('/', (req, res, next) => {
    if (req.event !== 'installation') {
        return next();
    }

    const { body: { action, installation: { id, account: { login: owner } } } } = req;

    let pendingPromise;

    if (action === 'created') {
        pendingPromise = installationManager.setInstallationId(owner, id);
    } else if (action === 'deleted') {
        pendingPromise = Promise.all([
            installationManager.deleteInstallationId(owner),
            installationInfoManager.deleteInstallationInfos(id),
            pullRequestManager.deletePullRequestInfos(owner),
            queueManager.deleteQueue(owner),
        ]);
    } else {
        return next();
    }

    pendingPromise
        .then(() => res.json(`Installation ${id} for ${owner} ${action}`))
        .catch(error => {
            logger.error(error);
            next(error);
        });

});

// Installation repositories
router.post('/', (req, res, next) => {
    if (req.event !== 'installation_repositories') {
        return next();
    }

    const { body: { action, installation: { id, account: { login: owner } } } } = req;

    installationInfoManager.deleteInstallationInfos(id)
        .then(() => res.json(`Installation repositories of installation ${id} for ${owner} ${action}`))
        .catch(error => {
            logger.error(error);
            next(error);
        });
});

// Catch all
router.all('/', (req, res) => res.json(''));

module.exports = router;
