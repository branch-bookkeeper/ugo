const localizify = require('localizify');

localizify
    .add('en', require('./messages/en.json'))
    .setLocale('en');

module.exports = localizify.t;
