const ua = require('universal-analytics');
const { path } = require('ramda');
const { env: { UA: accountId } } = process;

const getVisitor = userId => {
    return ua(
        accountId,
        userId || 'unknown',
        {
            https: true,
            strictCidFormat: false,
        }
    );
};

module.exports = {
    trackRequest: (req, res, next) => {
        const end = res.end;
        res.end = (chunk, encoding) => {
            res.end = end;
            res.end(chunk, encoding);

            const {
                ip: ipOverride,
                protocol,
                hostname,
                originalUrl,
            } = req;
            const userId = path(['user', 'username'], req);

            getVisitor(userId)
                .pageview({
                    userId,
                    ipOverride,
                    userAgentOverride: req.get('User-Agent'),
                    hitType: 'pageview',
                    documentLocationUrl: `${protocol}://${hostname}${originalUrl}`,
                })
                .send();
        };
        next();
    },
};
