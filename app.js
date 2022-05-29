//set up the server
const express = require( "express" );
const logger = require ("morgan");
const app = express();
const port = 8080;

//configure express to use EJS
app.set("views", __dirname + "/views")
app.set("view engine", "ejs");

const db = require('./db/db_pool')

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

app.get( "/menu/no_match", ( req, res ) => {
    res.render('no_match');
} );

// const read_orders_all_sql = `
//     SELECT
//         id, item, quantity, requests
//     FROM
//         orders
// `
const read_combined_all_sql = `
    SELECT
        orders.order_id, orders.item, orders.quantity, menu.price
    FROM
        orders
    INNER JOIN
        menu ON orders.item = menu.menu_item
`
// app.get("/menu", (req, res ) => {
//     db.execute(read_orders_all_sql, (error, results) => {
//         if (error)
//             res.status(500).send(error); //internal server error
//         else
//             res.render("menu", { inventory : results });
       
//     })
// } );

app.get("/menu", (req, res ) => {
    db.execute(read_combined_all_sql, (error, results) => {
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
        order_id = ?
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

const create_item_sql = `
INSERT INTO orders
    (item, quantity, requests)
VALUES
    (?, ?, ?)
`

const check_item_match_sql = `
    SELECT
        menu_item
    FROM
        menu
    WHERE
        menu_item = ?
`

app.post("/menu", (req, res) => {
    // follows the "name" specified in the form function
    // req.body.item
    // req.body.quantity
    db.execute(check_item_match_sql, [req.body.item], (error, results) => {
        if (error)
            res.status(500).send(error); //internal server error
        else if (results.length == 0)
            // res.status(404).send(`Please choose an item from the menu!`)
            res.redirect('/menu/no_match');
        else {
            db.execute(create_item_sql, [req.body.item, req.body.quantity, req.body.requests], (error, results) => {
                if (error)
                    res.status(500).send(error); //internal server error
                else {
                    res.redirect('/menu');
                }
            })
        }
    })
})

// app.post("/menu", (req, res) => {
//     // follows the "name" specified in the form function
//     // req.body.item
//     // req.body.quantity
//     db.execute(create_item_sql, [req.body.item, req.body.quantity, req.body.requests], (error, results) => {
//         if (error)
//             res.status(500).send(error); //internal server error
//         else {
//             res.redirect('/menu');
//         }
//     })
// })

const update_item_sql = `
    UPDATE
        orders
    SET
        quantity =?,
        requests =?
    WHERE
        order_id = ?
`

app.post("/menu/item/:id", (req,res) => {
    //req.params.id
    //req.body.quantity
    //req.body.request
    db.execute(update_item_sql, [req.body.quantity, req.body.request, req.params.id], (error, results) => {
        if (error)
            res.status(500).send(error); //internal server error
        else {
            res.redirect(`/menu/item/${req.params.id}`);
        }
    })
})
// OLD reading items code
// const read_orders_item_sql = `
//     SELECT
//         id, item, quantity, requests
//     FROM
//         orders
//     WHERE
//         id = ?
// `
const read_combined_item_sql =`
    SELECT
        orders.order_id, orders.item, orders.quantity, orders.requests, menu.menu_id, menu.menu_item, menu.price, menu.calories, menu.description
    FROM
        orders
    INNER JOIN
        menu ON orders.item = menu.menu_item
    WHERE
        orders.order_id = ?
`
// // OLD read details to items page
// app.get( "/menu/item/:id", (req, res ) => {
//     db.execute(read_orders_item_sql, [req.params.id], (error, results) => {
//         if(error)
//             res.status(500).send(error); //internal service error
//         else if (results.length == 0)
//             res.status(404).send(`No item found with id = ${req.params.id}`) //no page found error
//         else {
//             let data = results[0];
//             // console.log(data);
//             //{ item: ____, quality: ____, requests: ____}
//             res.render('item', data) //send item.ejs as html but use "data" as context for template to be rendered with
//         }
//         // res.send(results[0]);
//     })
// });

//define a route for the item detail page
app.get( "/menu/item/:id", (req, res ) => {
    db.execute(read_combined_item_sql, [req.params.id], (error, results) => {
        if(error)
            res.status(500).send(error); //internal service error
        else if (results.length == 0)
            res.status(404).send(`No item found with id = ${req.params.id}`) //no page found error
        else {
            let data = results[0];
            console.log("successfully rendered");
            // console.log(data);
            //{ item: ____, quality: ____, requests: ____}
            res.render('item', data) //send item.ejs as html but use "data" as context for template to be rendered with
        }
        // res.send(results[0]);
    })
});

// define a route for the menu inventory page
app.get( "/menu/item", ( req, res ) => {

    res.sendFile( __dirname + "/views/item.html" );
} );

// define a route for the item detail page
app.get( "/menu", ( req, res ) => {

    res.sendFile( __dirname + "/views/menu.html" );
} );

// start the server
app.listen( port, () => {
    console.log(`App server listening on ${ port }. (Go to http://localhost:${ port })` );
} );