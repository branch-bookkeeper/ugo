/* globals test, setup, suiteSetup, suite */
const { assert } = require('chai');
const mongoManager = require('../manager-mongo');
let collectionName;

suite('MongoManager', () => {
    setup(function () {
        if (!mongoManager.enabled()) {
            this.skip();
        }
        collectionName = Math.random().toString(36).substring(2);
    });

    test('Get collection', () => {
        return mongoManager.getCollection(collectionName)
            .then(collection => {
                assert.deepEqual(collectionName, collection.s.name);
            });
    });
});
