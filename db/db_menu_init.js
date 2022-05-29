const db = require("./db_connection");

const drop_menu_table_sql = "DROP TABLE IF EXISTS `menu`;"

db.execute(drop_menu_table_sql);

const create_menu_table_sql = `
CREATE TABLE menu ( 
    id INT NOT NULL AUTO_INCREMENT, 
    menu_item VARCHAR(45) NOT NULL, 
    price INT NOT NULL, 
    calories INT NOT NULL,
    description VARCHAR(150) NOT NULL,
    PRIMARY KEY (id)
    );
`

db.execute(create_menu_table_sql);

const insert_menu_table_sql = `
    INSERT INTO
        menu (menu_item, price, calories, description)
    VALUES 
        (?, ?, ?, ?);
`
//sample items in the database
db.execute(insert_menu_table_sql, ["Hamburger", "5", "500", "This is a burger"]);
db.execute(insert_menu_table_sql, ["Pizza", "5", "450", "This is a pizza"]);
db.execute(insert_menu_table_sql, ["Cookie", "2", "200", "This is a cookie"]);
db.execute(insert_menu_table_sql, ["Soda", "1", "100", "This is a can of soda"]);

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
