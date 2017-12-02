const MongoClient = require('mongodb').MongoClient;
let db;

MongoClient.connect(process.env.MONGO_URL)
    .then(d => {
        console.log('Connected to DB');
        db = d;
        return d.createCollection('pullRequest');
    })
    .then(collection => {
        console.log('Collection pullRequest created');

        return collection.createIndexes([
            {
                key: {
                    owner: 1,
                    repo: 1,
                },
                name: 'owner_repo',
            },
            {
                key: {
                    statusUrl: 1,
                },
                name: 'statusUrl',
            },
        ]);
    })
    .then(() => {
        console.log('Indexes created');

        db.close();
    })
    .catch(e => console.error(e));
