const MongoClient = require('mongodb').MongoClient;
const { env: { MONGO_URL } } = process;
let client;

MongoClient.connect(MONGO_URL, { useNewUrlParser: true })
    .then(c => {
        console.log('Connected to DB');
        client = c;
        return c.db();
    })
    .then(d => d.createCollection('installation'))
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

        client.close();
    })
    .catch(e => console.error(e));
