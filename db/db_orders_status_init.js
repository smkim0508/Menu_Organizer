const db = require("./db_connection");

//delete the table if it already exists

const drop_orders_status_table_sql = "DROP TABLE IF EXISTS `status`;"

db.execute(drop_orders_status_table_sql);

const create_orders_status_table_sql = `
CREATE TABLE status ( 
    history_id INT NOT NULL AUTO_INCREMENT,
    username VARCHAR(45) NOT NULL, 
    email VARCHAR(45) NOT NULL,
    phone VARCHAR(20) NULL,
    date TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    item VARCHAR (100) NOT NULL,
    quantity INT NOT NULL,
    requests VARCHAR(250) NULL,
    isComplete INT NOT NULL,
    sort INT NOT NULL
    PRIMARY KEY (history_id)
    );
`

db.execute(create_orders_status_table_sql);

const insert_orders_status_table_sql = `
    INSERT INTO
        status (username, email, item, quantity, isComplete, sort)
    VALUES 
        (?, ?, ?, ?, ?, ?);
`
//sample items in the database
db.execute(insert_orders_status_table_sql, ["user1", "chefminkim58@gmail.com", "cookies", "3", "1", "0"]);
db.execute(insert_orders_status_table_sql, ["user2", "sample2@email.com", " bread", "5", "1", "0"]);

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
