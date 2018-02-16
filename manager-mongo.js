const MongoClient = require('mongodb').MongoClient;
const logger = require('./logger');
const { isNil } = require('ramda');
const environment = process.env['NODE_ENV'] || 'production';
const { MONGO_URL } = process.env;
const development = environment === 'development';
const getDb = new Promise(resolve => {
    if (MONGO_URL) {
        MongoClient.connect(MONGO_URL)
            .then(db => {
                logger.info('Connected to mongo');
                resolve(db);
            });
    }
});

class MongoManager {
    static getCollection(collection) {
        return getDb.then(db => db.collection(collection));
    }

    static enabled() {
        return !isNil(MONGO_URL);
    }

    static reset() {
        return new Promise((resolve, reject) => getDb.then(db => db.listCollections().toArray()
            .then(collections => Promise.all(collections.map(({ name }) => name.indexOf('system.') === 0 ?
                Promise.resolve() : db.collection(name).deleteMany({})))
                .then(resolve)
                .catch(reject))));
    }
}

module.exports = MongoManager;
