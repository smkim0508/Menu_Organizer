const db = require("./db_connection");

//delete the table if it already exists

// const drop_tuff_table_sq1 = "DROP";
const drop_orders_table_sql = "DROP TABLE IF EXISTS `orders`;"

db.execute(drop_orders_table_sql);

const create_orders_table_sql = "CREATE TABLE orders ( id INT NOT NULL AUTO_INCREMENT, item VARCHAR(45) NOT NULL, quantity INT NOT NULL, requests VARCHAR(150) NULL, PRIMARY KEY (id));"

db.execute(create_orders_table_sql); //name sql 1?

const insert_orders_table_sql = "INSERT INTO stuff (item, quantity, request) VALUES (?,?,?);"

db.execute(insert_stuff_table_sql, ["Widgets", "5", "Widgets are cool!"]);
db.execute(insert_stuff_table_sql, ["Gizmos", "100", null]);
db.execute(insert_stuff_table_sql, ['Thingamajig', '12345', 'Not to be confused with a Thingamabob']);
db.execute(insert_stuff_table_sql, ['Thingamabob', '54321', 'Not to be confused with a Thingamajig']);


db.end();
