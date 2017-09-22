const router = require('express').Router();
const createError = require('http-errors');
const manager = require('./manager-queue');
const authenticator = require('./authenticator-github');

router.route('/:owner/:repository/:branch')
    .all(authenticator)
    .all((req, res, next) => {
        if (!manager.enabled()) {
            next(createError.ServiceUnavailable('queue not available'));
            return;
        }

        req.params.key = `${req.params.owner}:${req.params.repository}:${req.params.branch}`;

        next();
    })
    .get((req, res, next) => {
        manager.getItems(req.params.key)
            .then(data => res.send(data))
            .catch(next);
    })
    .post((req, res, next) => {
        manager.addItem(req.params.key, req.body)
            .then(data => res.status(201).json())
            .catch(next);
    })
    .delete((req, res, next) => {
        if (Object.keys(req.body).length > 0) {
            manager.removeItem(req.params.key, req.body)
                .then(res.status(204).json())
                .catch(next);
        } else {
            next(createError.BadRequest());
        }
    });

module.exports = router;
