const db = require("./db_connection");

//delete the table if it already exists

const drop_users_table_sql = "DROP TABLE IF EXISTS `users`;"

db.execute(drop_users_table_sql);

const create_users_table_sql = `
CREATE TABLE users ( 
    user_id INT NOT NULL AUTO_INCREMENT, 
    username VARCHAR(45) NOT NULL,
    email VARCHAR(45) NOT NULL,
    phone VARCHAR(20) NULL,
    isAdmin INT NOT NULL,
    PRIMARY KEY (user_id)
    );
`

db.execute(create_users_table_sql);

const insert_users_table_sql = `
    INSERT INTO
        users (username, email, isAdmin)
    VALUES 
        (?, ?, ?);
`

//sample items in the database
db.execute(insert_users_table_sql, ["Sungmin", "sunkim23@bergen.org", "1"]);
db.execute(insert_users_table_sql, ["Chef", "chefminkim58@gmail.com", "1"]);

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
