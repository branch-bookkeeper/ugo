const createError = require('http-errors');
const crypto = require('crypto');
const { env: { SECRET_TOKEN: token, NODE_ENV } } = process;
const environment = NODE_ENV || 'production';
const development = environment === 'development';
const test = environment === 'test';

const validator = (req, res, next) => {
    if (test || development || !token) {
        next();
        return;
    }

    const headerSignature = req.get('X-Hub-Signature');

    if (!headerSignature || headerSignature.indexOf('sha1=') !== 0) {
        return next(createError.Unauthorized('Unauthorized'));
    }

    const hmac = crypto.createHmac('sha1', token);
    hmac.update(Buffer.from(JSON.stringify(req.body)), 'utf-8');

    const computedSignature = `sha1=${hmac.digest('hex')}`;

    if (headerSignature !== computedSignature) {
        return next(createError.Unauthorized('Unauthorized'));
    }

    return next();
};

module.exports = validator;
