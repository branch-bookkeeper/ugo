const router = require('express').Router();
const createError = require('http-errors');
const manager = require('./manager-pullrequest');
const authenticator = require('./authenticator-github');

router.route('/:owner/:repository')
    .all(authenticator)
    .all((req, res, next) => {
        if (!manager.enabled()) {
            return next(createError.ServiceUnavailable('queue not available'));
        }
        next();
    })
    .get((req, res, next) => {
        manager.getRepositoryPullRequestsInfo(req.params.owner, req.params.repository)
            .then(data => data.length > 0 ? res.send(data) : next(createError.NotFound()))
            .catch(next);
    });

module.exports = router;
