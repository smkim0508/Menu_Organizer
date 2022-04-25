const mysql = require('mysql2');

const dbConfig = {
    host: "soccerdb.calingaiy4id.us-east-2.rds.amazonaws.com",
    port: 3306,
    user: "sunkim23",
    password: 0,
    database: "webapp2122t3_sunkim23",
    connectTimeout: 10000
}

const connection = mysql.createConnection(dbConfig);

module.exports = connection;