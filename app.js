//set up the server
const express = require( "express" );
const logger = require ("morgan");
const app = express();
const port = 8080;

//configure express to use EJS
app.set("views", __dirname + "/views")
app.set("view engine", "ejs");

const db = require('./db/db_connection')

//define middleware to handle POST requests (configure express to parse URL-encoded POST request bodies)
app.use( express.urlencoded({extended : false}));

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
            res.render("menu", { inventory : results });
       
    })
} );

const delete_orders_sql = `
    DELETE
    FROM
        orders
    WHERE
        id = ?
`

app.get("/menu/item/:id/delete", (req, res ) => {
    db.execute(delete_orders_sql, [req.params.id], ( error, results ) => {
        if (error)
            res.status(500).send(error);
        else {
            res.redirect("/menu");
        }
    })
})

//TEST
// const create_item_sql = `
// INSERT INTO orders
//     (quantity, request)
// VALUES
//     (?, ?)
// `

const create_item_sql = `
INSERT INTO orders
    (menu_item, quantity, request)
VALUES
    (?, ?, ?)
`

// TEST
// app.post("/menu", (req, res) => {
//     // follows the "name" specified in the form function
//     // req.body.menu_item
//     // req.body.quantity
//     // req.body.request 
//     db.execute(create_item_sql, [req.body.quantity, req.body.request], (error, results) => {
//         if (error)
//             res.status(500).send(error); //internal server error
//         else {
//             res.redirect('/menu');
//         }
//     })
// })

app.post("/menu", (req, res) => {
    // follows the "name" specified in the form function
    // req.body.menu_item
    // req.body.quantity
    // req.body.request 
    db.execute(create_item_sql, [req.body.menu_item, req.body.quantity, req.body.request], (error, results) => {
        if (error)
            res.status(500).send(error); //internal server error
        else {
            res.redirect('/menu');
        }
    })
})

const update_item_sql = `
    UPDATE
        stuff
    SET
        quantity =?,
        request =?
    WHERE
        id = ?
`

app.post("/stuff/item/:id", (req,res) => {
    //req.params.id
    //req.body.quantity
    //req.body.request
    db.execute(update_item_sql, [req.body.quantity, req.body.request], (error, results) => {
        if (error)
            res.status(500).send(error); //internal server error
        else {
            res.redirect(`/menu/item/${req.params.id}`);
        }
    })
})

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
        else {
            let data = results[0];
            //{ item: ____, quality: ____, requests: ____}
            res.render('item', data) //send item.ejs as html but use "data" as context for template to be rendered with
        }
        // res.send(results[0]);
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