const db = require("./db_connection");


db.execute('SELECT 1+1 AS solution',
    (error, results) => {
        if (error)
            throw error;
        console.log(results);
        console.log(`Solution: ${results[0].solution}`);
        // console.log(results[0].solution);
    }
);

db.end(); // optional: closes the connection after the queue is empty.