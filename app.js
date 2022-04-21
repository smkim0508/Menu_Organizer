//set up the server
const express = require( "express" );
const logger = require ("morgan");
const app = express();
const port = 8080;

// define middleware that logs all incoming requests
app.use(logger("dev"));

// define middleware that serves static resources in the public directory
app.use(express.static(__dirname + '/public'));

// define a route for the default home page
app.get( "/", ( req, res ) => {

    res.sendFile( __dirname + "/views/index.html" );
} );

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