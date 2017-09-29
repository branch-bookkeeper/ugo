const ua = require('universal-analytics');
const accountId = process.env['UA'];
const development = process.env['NODE_ENV'] === 'development';

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

            getVisitor(req.username)
                .pageview({
                    userId: req.username,
                    uip: req.ip,
                    ua: req.get('User-Agent'),
                    t: 'pageview',
                    dl: req.protocol + '://' + req.hostname + req.originalUrl,
                })
                .send();
        };
        next();
    },
};
