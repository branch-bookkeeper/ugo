const MongoClient = require('mongodb').MongoClient;
const { env: { MONGO_URL } } = process;
let client;

MongoClient.connect(MONGO_URL, { useUnifiedTopology: true })
    .then(c => {
        console.log('Connected to DB');
        client = c;
        return c.db();
    })
    .then(d => d.createCollection('queue'))
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

        client.close();
    })
    .catch(e => console.error(e));
