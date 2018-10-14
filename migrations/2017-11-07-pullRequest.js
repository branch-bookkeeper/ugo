const MongoClient = require('mongodb').MongoClient;
const { env: { MONGO_URL } } = process;
let client;

MongoClient.connect(MONGO_URL, { useNewUrlParser: true })
    .then(c => {
        console.log('Connected to DB');
        client = c;
        return c.db();
    })
    .then(d => d.createCollection('pullRequest'))
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

        client.close();
    })
    .catch(e => console.error(e));
