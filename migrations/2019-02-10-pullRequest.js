const MongoClient = require('mongodb').MongoClient;
const { env: { MONGO_URL } } = process;
let client;

MongoClient.connect(MONGO_URL, { useUnifiedTopology: true })
    .then(c => {
        console.log('Connected to DB');
        client = c;
        return c.db();
    })
    .then(d => d.collection('pullRequest'))
    .then(collection => collection.dropIndex('statusUrl'))
    .then(() => {
        console.log('Index dropped');

        client.close();
    })
    .catch(e => console.error(e));
