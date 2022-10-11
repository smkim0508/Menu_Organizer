const db = require("./db_connection");

const drop_menu_table_sql = "DROP TABLE IF EXISTS `menu`;"

db.execute(drop_menu_table_sql);

const create_menu_table_sql = `
CREATE TABLE menu ( 
    menu_id INT NOT NULL AUTO_INCREMENT, 
    menu_item VARCHAR(100) NOT NULL, 
    price INT NOT NULL, 
    calories INT NOT NULL,
    description VARCHAR(250) NOT NULL,
    numAvail INT NOT NULL,
    PRIMARY KEY (menu_id)
    );
`

db.execute(create_menu_table_sql);

const insert_menu_table_sql = `
    INSERT INTO
        menu (menu_item, price, calories, description, numAvail)
    VALUES 
        (?, ?, ?, ?, ?);
`
//sample items in the database
db.execute(insert_menu_table_sql, ["Hamburger", "5", "500", "This is a burger", "3"]);
db.execute(insert_menu_table_sql, ["Pizza", "5", "450", "This is a pizza", "3"]);
db.execute(insert_menu_table_sql, ["Cookie", "2", "200", "This is a cookie", "20"]);
db.execute(insert_menu_table_sql, ["Soda", "1", "100", "This is a can of soda", "20"]);
db.execute(insert_menu_table_sql, ["Bread", "2", "300", "This is a loaf of bread", "10"]);

const read_menu_table_sql = "SELECT * FROM menu";

db.execute(read_menu_table_sql, 
    (error, results) => {
        if (error)
            throw error;
        console.log("Table 'menu' initialized with:")
        console.log(results);
    }
);

db.end();
