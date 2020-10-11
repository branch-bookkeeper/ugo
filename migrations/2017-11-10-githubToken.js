const MongoClient = require('mongodb').MongoClient;
const { env: { MONGO_URL } } = process;
let client;

MongoClient.connect(MONGO_URL, { useUnifiedTopology: true })
    .then(c => {
        console.log('Connected to DB');
        client = c;
        return c.db();
    })
    .then(d => d.createCollection('githubToken'))
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

        client.close();
    })
    .catch(e => console.error(e));
