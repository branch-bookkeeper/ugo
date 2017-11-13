const MongoClient = require('mongodb').MongoClient;
let db;

MongoClient.connect(process.env.MONGO_URL)
    .then(d => {
        console.log('Connected to DB');
        db = d;
        return d.dropDatabase();
    })
    .then(() => {
        console.log('Database dropped');

        db.close();
    })
    .catch(e => {
        console.error(e);
    });
