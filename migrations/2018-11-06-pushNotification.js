const MongoClient = require('mongodb').MongoClient;
const { env: { MONGO_URL } } = process;
let client;

MongoClient.connect(MONGO_URL, { useUnifiedTopology: true })
    .then(c => {
        console.log('Connected to DB');
        client = c;
        return c.db();
    })
    .then(d => d.createCollection('pushNotification'))
    .then(collection => {
        console.log('Collection pushNotification created');

        return collection.createIndexes([
            {
                key: {
                    title: 1,
                    message: 1,
                    sendAt: 1,
                    type: 1,
                    owner: 1,
                    repo: 1,
                    pullRequestNumber: 1,
                    username: 1,
                },
                name: 'unique_fields',
            },
            {
                key: {
                    createdAt: 1,
                },
                expireAfterSeconds: 120, // It's 2 * SEND_DELAY
                name: 'createdAt',
            },
        ]);
    })
    .then(() => {
        console.log('Indexes created');

        client.close();
    })
    .catch(e => console.error(e));
