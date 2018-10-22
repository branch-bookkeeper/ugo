const MongoClient = require('mongodb').MongoClient;
const { env: { MONGO_URL } } = process;
let client;

MongoClient.connect(MONGO_URL, { useNewUrlParser: true })
    .then(c => {
        console.log('Connected to DB');
        client = c;
        return c.db();
    })
    .then(d => d.createCollection('installationInfo'))
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

        client.close();
    })
    .catch(e => console.error(e));
