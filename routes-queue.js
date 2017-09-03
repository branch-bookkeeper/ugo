const router = require('express').Router();
const redis = require('./redis');
const createError = require('http-errors');
const prefix = 'booking';

router.route('/:user/:repository/:branch')
    .all((req, res, next) => {
        if (!redis.enabled()) {
            next(createError.ServiceUnavailable('redis not available'));
            return;
        }

        req.params.key = `${prefix}:${req.params.user}:${req.params.repository}:${req.params.branch}`;

        next();
    })
    .get((req, res, next) => {
        redis.lrange(req.params.key)
            .then(res.json)
            .catch(next);
    })
    .post((req, res, next) => {
        redis.push(req.params.key, req.body)
            .then(data => res.status(201).json(data))
            .catch(next);
    })
    .delete((req, res, next) => {
        if (Object.keys(req.body).length > 0) {
            redis.lrem(req.params.key, req.body)
                .then(req.body)
                .catch(next);
        } else {
            next(createError.BadRequest());
        }
    });

module.exports = router;
