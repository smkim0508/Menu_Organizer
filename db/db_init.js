const db = require("./db_connection");

//delete the table if it already exists

const drop_orders_table_sql = "DROP TABLE IF EXISTS `orders`;"

db.execute(drop_orders_table_sql);

const create_orders_table_sql = `
CREATE TABLE orders ( 
    id INT NOT NULL AUTO_INCREMENT, 
    item VARCHAR(45) NOT NULL, 
    quantity INT NOT NULL, 
    requests VARCHAR(150) NULL, 
    PRIMARY KEY (id)
    );
`

db.execute(create_orders_table_sql);

const insert_orders_table_sql = `
    INSERT INTO
        orders (item, quantity, requests)
    VALUES 
        (?, ?, ?);
`

db.execute(insert_orders_table_sql, ["Widgets", "5", "Widgets are cool!"]);
db.execute(insert_orders_table_sql, ["Gizmos", "100", null]);
db.execute(insert_orders_table_sql, ['Thingamajig', '12345', 'Not to be confused with a Thingamabob']);
db.execute(insert_orders_table_sql, ['Thingamabob', '54321', 'Not to be confused with a Thingamajig']);

const read_orders_table_sql = "SELECT * FROM orders";

db.execute(read_orders_table_sql, 
    (error, results) => {
        if (error)
            throw error;
        console.log("Table 'orders' initialized with:")
        console.log(results);
    }
);

db.end();
