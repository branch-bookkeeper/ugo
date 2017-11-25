const router = require('express').Router();
const createError = require('http-errors');
const manager = require('./manager-pullrequest');
const authenticator = require('./authenticator-github');

router.route('/:owner/:repository/:pullrequest')
    .all(authenticator)
    .all((req, res, next) => {
        if (!manager.enabled()) {
            next(createError.ServiceUnavailable('queue not available'));
            return;
        }
        next();
    })
    .get((req, res, next) => {
        manager.getPullRequestInfo(req.params.owner, req.params.repository, req.params.pullrequest)
            .then(data => data ? res.send(data) : next(createError.NotFound()))
            .catch(next);
    });

router.route('/:owner/:repository')
    .all(authenticator)
    .all((req, res, next) => {
        if (!manager.enabled()) {
            next(createError.ServiceUnavailable('queue not available'));
            return;
        }
        next();
    })
    .get((req, res, next) => {
        manager.getRepositoryPullRequestsInfo(req.params.owner, req.params.repository)
            .then(data => data.length > 0 ? res.send(data) : next(createError.NotFound()))
            .catch(next);
    });

module.exports = router;
