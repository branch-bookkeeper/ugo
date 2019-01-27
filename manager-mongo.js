let database;
const MongoClient = require('mongodb').MongoClient;
const logger = require('./logger');
const { isNil } = require('ramda');
const { env: { MONGO_URL } } = process;
const getDb = new Promise(resolve => {
    if (MONGO_URL) {
        if (!isNil(database)) {
            return resolve(database);
        }
        MongoClient.connect(MONGO_URL, { useNewUrlParser: true })
            .then(c => c.db())
            .then(db => {
                logger.info('Connected to mongo');
                database = db;
                resolve(db);
            })
            .catch(e => {
                logger.error('Error connectiong to mongo', e);
                resolve({});
            });
    } else {
        logger.error('Missing MONGO_URL env var');
        resolve({});
    }
});

class MongoManager {
    static getCollection(collection) {
        return getDb.then(db => db.collection(collection));
    }

    static enabled() {
        return !isNil(MONGO_URL) && !isNil(database);
    }

    static reset() {
        return new Promise((resolve, reject) => getDb.then(db => db.listCollections().toArray()
            .then(collections => Promise.all(collections.map(({ name }) => name.indexOf('system.') === 0
                ? Promise.resolve() : db.collection(name).deleteMany({})))
                .then(resolve)
                .catch(reject))));
    }
}

module.exports = MongoManager;
