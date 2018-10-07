const ua = require('universal-analytics');
const { path } = require('ramda');
const { env: { UA: accountId, NODE_ENV } } = process;
const development = NODE_ENV === 'development';

const getVisitor = userId => {
    const visitor = ua(
        accountId,
        userId || 'unknown',
        {
            https: true,
            strictCidFormat: false,
        }
    );

    return development ? visitor.debug() : visitor;
};

module.exports = {
    trackRequest: (req, res, next) => {
        const end = res.end;
        res.end = (chunk, encoding) => {
            res.end = end;
            res.end(chunk, encoding);

            const {
                ip: uip,
                protocol,
                hostname,
                originalUrl,
            } = req;
            const userId = path(['user', 'username'], req);

            getVisitor(userId)
                .pageview({
                    userId,
                    uip,
                    ua: req.get('User-Agent'),
                    t: 'pageview',
                    dl: `${protocol}://${hostname}${originalUrl}`,
                })
                .send();
        };
        next();
    },
};
