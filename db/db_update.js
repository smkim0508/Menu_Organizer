const db = require("./db_connection");

// update the 'status' table // could be adjusted to update any other tables

const alter_table_sql = `
    ALTER TABLE 
        status
    ADD
        sort INT NOT NULL
`

db.execute(alter_table_sql);

const update_table_sql = `
    UPDATE
        status
    SET
        sort = 1
`
//sample items in the database
db.execute(update_table_sql);

const read_orders_status_table_sql = "SELECT * FROM status";

db.execute(read_orders_status_table_sql, 
    (error, results) => {
        if (error)
            throw error;
        console.log("Table 'status' updated to:")
        console.log(results);
    }
);

db.end();
