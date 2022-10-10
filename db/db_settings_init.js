const db = require("./db_connection");

//delete the table if it already exists

const drop_settings_table_sql = "DROP TABLE IF EXISTS `settings`;"

db.execute(drop_settings_table_sql);

const create_settings_table_sql = `
CREATE TABLE settings ( 
    numOrders INT NOT NULL
    );
`

db.execute(create_settings_table_sql);

const insert_settings_table_sql = `
    INSERT INTO
        settings (numOrders)
    VALUES 
        (?);
`

db.execute(insert_settings_table_sql, ["3"]);

const read_settings_table_sql = `SELECT * FROM settings`;

db.execute(read_settings_table_sql, 
    (error, results) => {
        if (error)
            throw error;
        console.log("Table 'settings' initialized with:")
        console.log(results);
    }
);

db.end();
