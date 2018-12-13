const router = require('express').Router();
const createError = require('http-errors');
const manager = require('./manager-queue');
const pusherHandler = require('./handler-notification-pusher');
const authenticator = require('./authenticator-github');
const validator = require('./validator-queue');

router.route('/:owner/:repository/:branch')
    .all(authenticator)
    .all((req, res, next) => {
        if (!manager.enabled()) {
            return next(createError.ServiceUnavailable('Queue not available'));
        }

        next();
    })
    .get((req, res, next) => {
        const { params: { owner, repository, branch } } = req;
        manager.getItems(owner, repository, branch)
            .then(data => res.set({ 'Cache-Control': 'no-cache' }).json(data))
            .catch(next);
    })
    .post(validator)
    .delete(validator)
    .all((req, res, next) => {
        const { user: { username, permissions: { isAdmin } }, body } = req;
        if (body.username !== username && !isAdmin) {
            next(createError.Unauthorized('Unauthorized'));
        } else {
            next();
        }
    })
    .post((req, res, next) => {
        const { params: { owner, repository, branch }, body } = req;
        manager.addItem(owner, repository, branch, body)
            .then(res.status(201).json())
            .catch(next);
    })
    .delete((req, res, next) => {
        const { params: { owner, repository, branch }, body } = req;
        manager.removeItem(owner, repository, branch, body)
            .then(res.status(204).json())
            .catch(next);
    });

router.route('/:owner/:repository/:branch/update-channel')
    .all(authenticator)
    .get((req, res, next) => {
        const { params: { owner, repository, branch } } = req;
        res.send({
            id: pusherHandler.getChannelId(owner, repository, branch),
        });
    });

module.exports = router;
