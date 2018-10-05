const router = require('express').Router();
const createError = require('http-errors');
const manager = require('./manager-queue');
const pusherManager = require('./manager-notification-pusher.js');
const authenticator = require('./authenticator-github');

router.route('/:owner/:repository/:branch')
    .all(authenticator)
    .all((req, res, next) => {
        if (!manager.enabled()) {
            return next(createError.ServiceUnavailable('Queue not available'));
        }

        next();
    })
    .get((req, res, next) => {
        manager.getItems(req.params.owner, req.params.repository, req.params.branch)
            .then(data => res.set({ 'Cache-Control': 'no-cache' }).json(data))
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

router.route('/:owner/:repository/:branch/update-channel')
    .all(authenticator)
    .get((req, res, next) => res.send({
        id: pusherManager.getChannelId(req.params.owner, req.params.repository, req.params.branch),
    }));

module.exports = router;
