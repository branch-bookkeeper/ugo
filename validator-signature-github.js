const createError = require('http-errors');
const crypto = require('crypto');
const { env: { SECRET_TOKEN: token, NODE_ENV } } = process;
const environment = NODE_ENV || 'production';
const development = environment === 'development';
const test = environment === 'test';

const validator = (req, res, next) => {
    if (test || development || !token) {
        return next();
    }

    const headerSignature = req.get('X-Hub-Signature');
    const hmac = crypto.createHmac('sha1', token);
    hmac.update(Buffer.from(JSON.stringify(req.body)), 'utf-8');

    const computedSignature = `sha1=${hmac.digest('hex')}`;

    if (!headerSignature || headerSignature !== computedSignature) {
        return next(createError.Unauthorized('Unauthorized'));
    }

    next();
};

module.exports = validator;
