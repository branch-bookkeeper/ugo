const createError = require('http-errors');
const crypto = require('crypto');
const environment = process.env.NODE_ENV || 'production';
const development = environment === 'development';
const test = environment === 'test';
const token = process.env.SECRET_TOKEN;

const validator = (req, res, next) => {
    if (test || development || !token) {
        next();
        return;
    }

    const headerSignature = req.get('X-Hub-Signature');

    if (!headerSignature || headerSignature.indexOf('sha1=') !== 0) {
        next(createError.Unauthorized('Unauthorized'));
        return;
    }

    const hmac = crypto.createHmac('sha1', token);
    hmac.update(Buffer.from(JSON.stringify(req.body)), 'utf-8');

    const computedSignature = `sha1=${hmac.digest('hex')}`;

    if (headerSignature !== computedSignature) {
        return next(createError.Unauthorized('Unauthorized'));
    }

    next();
};

module.exports = validator;
