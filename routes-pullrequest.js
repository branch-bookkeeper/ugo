const router = require('express').Router();
const createError = require('http-errors');
const manager = require('./manager-pullrequest');
const authenticator = require('./authenticator-github');

router.route('/:owner/:repository/:branch/:pullrequest')
    .all(authenticator)
    .all((req, res, next) => {
        if (!manager.enabled()) {
            next(createError.ServiceUnavailable('queue not available'));
            return;
        }

        req.params.key = `${req.params.owner}:${req.params.repository}:${req.params.pullrequest}`;

        next();
    })
    .get((req, res, next) => {
        manager.getPullRequestInfo(req.params.owner, req.params.repository, req.params.pullrequest)
            .then(data => res.send(data))
            .catch(next);
    });

module.exports = router;
