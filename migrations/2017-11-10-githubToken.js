const MongoClient = require('mongodb').MongoClient;
let db;

MongoClient.connect(process.env.MONGO_URL)
    .then(d => {
        console.log('Connected to DB');
        db = d;
        return db.createCollection('githubToken');
    })
    .then(collection => {
        console.log('Collection githubToken created');

        return collection.createIndexes([
            {
                key: {
                    login: 1,
                },
                name: 'login',
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
