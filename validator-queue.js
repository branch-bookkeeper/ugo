const Joi = require('@hapi/joi');
const createError = require('http-errors');

const schema = Joi.object().keys({
    username: Joi.string().required(),
    pullRequestNumber: Joi.number().integer().positive().required(),
    createdAt: Joi.date().iso().required(),
});

const validator = (req, res, next) => {
    const { error, value } = Joi.validate(req.body, schema);

    if (error) {
        const { details: [{ message }] } = error;
        return next(createError.BadRequest(message));
    }

    req.body = value;

    next();
};

module.exports = validator;
