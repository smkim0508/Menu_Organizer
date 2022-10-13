const db = require("./db_connection");

//delete the table if it already exists

const drop_settings_table_sql = "DROP TABLE IF EXISTS `settings`;"

db.execute(drop_settings_table_sql);

const create_settings_table_sql = `
CREATE TABLE settings ( 
    orderBy VARCHAR(25) NOT NULL

    );
`

db.execute(create_settings_table_sql);

const insert_settings_table_sql = `
    INSERT INTO
        settings (orderBy)
    VALUES 
        (?);
`

db.execute(insert_settings_table_sql, ["Date ??/??"]);

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
