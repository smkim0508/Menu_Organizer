const db = require("./db_connection");

const read_settings_table_sql = `SELECT * FROM settings`;

db.execute(read_settings_table_sql, 
    (error, results) => {
        if (error)
            throw error;
        console.log("Table 'settings':")
        console.log(results);
    }
);

db.end();
