//set up the server
const express = require( "express" );
const logger = require ("morgan");
const app = express();
const port = 8080;

//configure express to use EJS
app.set("views", __dirname + "/views")
app.set("view engine", "ejs");

const db = require('./db/db_connection')

// define middleware that logs all incoming requests
app.use(logger("dev"));

// define middleware that serves static resources in the public directory
app.use(express.static(__dirname + '/public'));

// define a route for the default home page
app.get( "/", ( req, res ) => {
    res.render('index');
} );

const read_orders_all_sql = `
    SELECT
        id, item, quantity, requests
    FROM
        orders
`

app.get("/menu", (req, res ) => {
    db.execute(read_orders_all_sql, (error, results) => {
        if (error)
            res.status(500).send(error); //internal server error
        else
            res.send(results);
    })
} );

const read_orders_item_sql = `
    SELECT
        id, item, quantity, requests
    FROM
        orders
    WHERE
    id = ?
`
//define a route for the item detail page
app.get( "/menu/item/:id", (req, res ) => {
    db.execute(read_orders_item_sql, [req.params.id], (error, results) => {
        if(error)
            res.status(500).send(error); //internal service error
        else if (results.length == 0)
            res.status(404).send(`No item found with id = ${req.params.id}`) //no page found error
        else    res.send(results[0]);
    })
}); 

// define a route for the stuff inventory page
app.get( "/menu/item", ( req, res ) => {

    res.sendFile( __dirname + "/views/item.html" );
} );

// define a route for the item detail page
app.get( "/menu", ( req, res ) => {

    res.sendFile( __dirname + "/views/menu.html" );
} );

// app.get("/style.css", (req, res) => {
    // res.sendFile( __dirname + "/styles/style.css");
// })

// app.get("/menu.css", (req, res) => {
    // res.sendFile( __dirname + "/styles/menu.css");
// })

// app.get("/item.css", (req, res) => {
    // res.sendFile( __dirname + "/styles/item.css" );
// })
// start the server
app.listen( port, () => {
    console.log(`App server listening on ${ port }. (Go to http://localhost:${ port })` );
} );