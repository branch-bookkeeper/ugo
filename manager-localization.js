const localizify = require('localizify');

localizify
    .add('en', require('./messages/en'))
    .setLocale('en');

module.exports = localizify.t;
