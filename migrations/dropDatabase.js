const MongoClient = require('mongodb').MongoClient;
const { env: { MONGO_URL } } = process;
let client;

MongoClient.connect(MONGO_URL, { useNewUrlParser: true })
    .then(c => {
        console.log('Connected to DB');
        client = c;
        return client.db().dropDatabase();
    })
    .then(() => {
        console.log('Database dropped');

        client.close();
    })
    .catch(e => {
        console.error(e);
    });
