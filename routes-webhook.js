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

// Username
router.post('/', (req, res, next) => {
    if (!pullRequestManager.enabled()) {
        next(createError.ServiceUnavailable('queue not available'));
        return;
    }

    const { sender: { login: username } } = req.body;

    req.username = username;
    req.event = req.get('X-GitHub-Event');
    next();
});

// Repositories
router.post('/', (req, res, next) => {
    if (req.event !== 'repository') {
        next();
        return;
    }

    const { repository: { owner: { login: owner } } } = req.body;

    installationManager.getInstallationId(owner)
        .then(installationInfoManager.deleteInstallationInfos)
        .then(() => res.json(`Installation infos of ${owner} deleted`));
});

// PR
router.post('/', (req, res, next) => {
    if (req.event !== 'pull_request') {
        next();
        return;
    }

    const { action, installation: { id: installationId }, pull_request: pullRequest } = req.body;

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
        next();
        return;
    }

    const { action, installation } = req.body;
    const { id } = installation;
    const { account: { login: owner } } = installation;

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
        next();
        return;
    }

    const { action, installation } = req.body;
    const { id } = installation;
    const { account: { login: owner } } = installation;

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
