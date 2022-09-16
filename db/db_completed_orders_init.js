const db = require("./db_connection");

//delete the table if it already exists

const drop_orders_status_table_sql = "DROP TABLE IF EXISTS `status`;"

db.execute(drop_orders_status_table_sql);

const create_orders_status_table_sql = `
CREATE TABLE status ( 
    completed_id INT NOT NULL AUTO_INCREMENT, 
    email VARCHAR(45) NULL,
    date 
    isComplete INT NOT NULL,
    PRIMARY KEY (completed_id) 
    );
`

db.execute(create_orders_status_table_sql);

const insert_completed_orders_table_sql = `
    INSERT INTO
        completed orders (email, i)
    VALUES 
        (?, ?);
`
//sample items in the database
db.execute(insert_users_table_sql, ["sunkim23@bergen.org", "1"]);
db.execute(insert_users_table_sql, ["chefminkim58@gmail.com", "1"]);

const read_users_table_sql = "SELECT * FROM users";

db.execute(read_users_table_sql, 
    (error, results) => {
        if (error)
            throw error;
        console.log("Table 'users' initialized with:")
        console.log(results);
    }
);

db.end();
