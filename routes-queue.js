const router = require('express').Router();
const redis = require('./redis');
const createError = require('http-errors');
const postal = require('postal');
const prefix = 'booking';

router.route('/:owner/:repository/:branch')
    .all((req, res, next) => {
        if (!redis.enabled()) {
            next(createError.ServiceUnavailable('redis not available'));
            return;
        }

        req.params.key = `${prefix}:${req.params.owner}:${req.params.repository}:${req.params.branch}`;

        next();
    })
    .get((req, res, next) => {
        redis.lrange(req.params.key)
            .then(data => res.send(data))
            .catch(next);
    })
    .post((req, res, next) => {
        const key = req.params.key;
        redis.push(key, req.body)
            .then(data => {
                postal.publish({
                    channel: 'queue',
                    topic: 'item.add',
                    data: {
                        queue: key.replace(`${prefix}:`, ''),
                        item: req.body,
                    },
                });
                return data;
            })
            .then(data => res.status(201).json(data))
            .catch(next);
    })
    .delete((req, res, next) => {
        if (Object.keys(req.body).length > 0) {
            const key = req.params.key;
            redis.lrem(key, req.body)
                .then(() => {
                    postal.publish({
                        channel: 'queue',
                        topic: 'item.remove',
                        data: {
                            queue: key.replace(`${prefix}:`, ''),
                            item: req.body,
                        },
                    });
                })
                .then(res.json(req.body))
                .catch(next);
        } else {
            next(createError.BadRequest());
        }
    });

module.exports = router;
