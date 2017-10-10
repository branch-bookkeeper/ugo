const router = require('express').Router();
const Github = require('./github');
const createError = require('http-errors');
const {
    findIndex,
    propEq,
    find,
    pluck,
} = require('ramda');
const manager = require('./manager-queue');
const installationManager = require('./manager-installation');
const pullRequestManager = require('./manager-pullrequest');
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

// Installation repositories
router.post('/', (req, res, next) => {
    if (req.event !== 'repository') {
        next();
        return;
    }

    const { repository: { owner: { login: owner } } } = req.body;

    installationManager.getInstallationId(owner)
        .then(installationManager.deleteInstallationInfos)
        .then(() => res.send(`Installation infos of ${owner} deleted`));
});

// PR
router.post('/', (req, res, next) => {
    if (req.event !== 'pull_request') {
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
            installationManager.deleteInstallationInfos(id),
            pullRequestManager.deletePullRequestInfos(owner),
        ]);
    }

    pendingPromise
        .then(() => res.send(`Installation ${id} for ${owner} ${action}`))
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

    installationManager.deleteInstallationInfos(id)
        .then(() => res.send(`Installation repositories of installation ${id} for ${owner} ${action}`))
        .catch(error => {
            logger.error(error);
            next(error);
        });
});

const _handleClosed = (req, res, next) => {
    const body = req.body;
    const { pull_request: pullRequest } = body;
    const {
        number: pullRequestNumber,
        base: {
            repo: baseRepo,
            ref: branch,
        },
        merged_by: mergeUser,
    } = pullRequest;
    const { name: repo, owner: { login: owner } } = baseRepo;
    const meta = {
        mergedByUsername: mergeUser ? mergeUser.login : null,
    };

    manager.getItems(`${owner}:${repo}:${branch}`)
        .then(bookingData => {
            const item = find(propEq('pullRequestNumber', pullRequestNumber))(bookingData);
            if (item) {
                return manager.removeItem(`${owner}:${repo}:${branch}`, item, meta);
            }
        })
        .then(() => pullRequestManager.deletePullRequestInfo(owner, repo, pullRequestNumber))
        .then(() => res.send(`PR ${owner}/${repo}/${branch} #${pullRequestNumber} closed`))
        .catch(error => {
            logger.error(error);
            next(error);
        });
};

const _handleOpened = (req, res, next) => {
    const body = req.body;
    const { installation: { id: installationId }, pull_request: pullRequest } = body;
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
    let status;
    let description;
    let targetUrl;

    pullRequestManager.setPullRequestInfo(owner, repo, pullRequestNumber, {
        statusUrl,
        installationId,
        pullRequestNumber,
        title,
        author,
        humanUrl,
        assignees: pluck('login', assignees),
    })
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
        .catch(error => {
            logger.error(error);
            next(error);
        });
};

// Catch all
router.all('/', (req, res) => res.send(''));

module.exports = router;
