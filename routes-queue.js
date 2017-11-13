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

        next();
    })
    .get((req, res, next) => {
        manager.getItems(req.params.owner, req.params.repository, req.params.branch)
            .then(data => res
                .set({ 'Cache-Control': 'no-cache' })
                .send(data))
            .catch(next);
    })
    .post((req, res, next) => {
        manager.addItem(req.params.owner, req.params.repository, req.params.branch, req.body)
            .then(res.status(201).json())
            .catch(next);
    })
    .delete((req, res, next) => {
        if (Object.keys(req.body).length > 0) {
            manager.removeItem(req.params.owner, req.params.repository, req.params.branch, req.body)
                .then(res.status(204).json())
                .catch(next);
        } else {
            next(createError.BadRequest());
        }
    });

module.exports = router;
