const MongoClient = require('mongodb').MongoClient;
let db;

MongoClient.connect(process.env.MONGO_URL)
    .then(d => {
        console.log('Connected to DB');
        db = d;
        return db.createCollection('installationInfo');
    })
    .then(collection => {
        console.log('Collection installationInfo created');

        return collection.createIndexes([
            {
                key: {
                    installationId: 1,
                },
                name: 'installationId',
            },
            {
                key: {
                    created_at: 1,
                },
                expireAfterSeconds: 86400,
                name: 'created_at',
            },
        ]);
    })
    .then(() => {
        console.log('Indexes created');

        db.close();
    })
    .catch(e => console.error(e));
