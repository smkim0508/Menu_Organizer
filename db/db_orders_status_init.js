const db = require("./db_connection");

//delete the table if it already exists

const drop_orders_status_table_sql = "DROP TABLE IF EXISTS `status`;"

db.execute(drop_orders_status_table_sql);

const create_orders_status_table_sql = `
CREATE TABLE status ( 
    completed_id INT NOT NULL AUTO_INCREMENT, 
    email VARCHAR(45) NULL,
    date TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    isComplete INT NOT NULL,
    PRIMARY KEY (completed_id) 
    );
`

db.execute(create_orders_status_table_sql);

const insert_orders_status_table_sql = `
    INSERT INTO
        status (email, isComplete)
    VALUES 
        (?, ?);
`
//sample items in the database
db.execute(insert_orders_status_table_sql, ["sample@email.com", "1"]);
db.execute(insert_orders_status_table_sql, ["sample2@email.com", "1"]);

const read_orders_status_table_sql = "SELECT * FROM status";

db.execute(read_orders_status_table_sql, 
    (error, results) => {
        if (error)
            throw error;
        console.log("Table 'status' initialized with:")
        console.log(results);
    }
);

db.end();
