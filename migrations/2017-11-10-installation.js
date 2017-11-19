const MongoClient = require('mongodb').MongoClient;
let db;

MongoClient.connect(process.env.MONGO_URL)
    .then(d => {
        console.log('Connected to DB');
        db = d;
        return db.createCollection('installation');
    })
    .then(collection => {
        console.log('Collection installation created');

        return collection.createIndexes([
            {
                key: {
                    owner: 1,
                },
                name: 'owner',
            },
        ]);
    })
    .then(() => {
        console.log('Index created');

        db.close();
    })
    .catch(e => console.error(e));
