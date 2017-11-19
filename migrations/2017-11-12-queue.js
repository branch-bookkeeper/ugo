const MongoClient = require('mongodb').MongoClient;
let db;

MongoClient.connect(process.env.MONGO_URL)
    .then(d => {
        console.log('Connected to DB');
        db = d;
        return d.createCollection('queue');
    })
    .then(collection => {
        console.log('Collection queue created');

        return collection.createIndexes([
            {
                key: {
                    queue: 1,
                },
                name: 'queue',
            },
            {
                key: {
                    owner: 1,
                    repo: 1,
                },
                name: 'owner-repo',
            },
        ]);
    })
    .then(() => {
        console.log('Indexes created');

        db.close();
    })
    .catch(e => console.error(e));
