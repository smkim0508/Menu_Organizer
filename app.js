//set up the server
const express = require( "express" );
const logger = require ("morgan");
const app = express();

//set up port
const dotenv = require('dotenv');
dotenv.config();
const port = process.env.PORT;

//configure express to use EJS
app.set("views", __dirname + "/views")
app.set("view engine", "ejs");

const db = require('./db/db_pool')

//auth 0 stuff
const { auth } = require('express-openid-connect');

const config = {
  authRequired: false,
  auth0Logout: true,
  secret: process.env.SECRET,
  baseURL: 'http://localhost:80',
  clientID: 'pDCzPXPddFBPQWeBXZAXC21IEbxcskGF',
  issuerBaseURL: 'https://dev-hnm1jfku.us.auth0.com'
};

// auth router attaches /login, /logout, and /callback routes to the baseURL
app.use(auth(config));

//define middleware to handle POST requests (configure express to parse URL-encoded POST request bodies)
app.use( express.urlencoded({extended : false}));

// define middleware that logs all incoming requests
app.use(logger("dev"));

// define middleware that serves static resources in the public directory
app.use(express.static(__dirname + '/public'));

// req.isAuthenticated is provided from the auth router
app.get('/testLogin', (req, res) => {
    res.send(req.oidc.isAuthenticated() ? 'Logged in' : 'Logged out');
  });

const { requiresAuth } = require('express-openid-connect');

app.get('/profile', requiresAuth(), (req, res) => {
    res.send(JSON.stringify(req.oidc.user));
});

// define a route for the default home page
app.get( "/", ( req, res ) => {
    res.render('index');
} );

app.get( "/menu/no_match", ( req, res ) => {
    res.render('no_match');
} );

app.get( "/menu/no_id_found", ( req, res ) => {
    res.render('no_order_id_found');
} );

app.get( "/edit/no_id_found", ( req, res ) => {
    res.render('no_menu_id_found');
} );

const read_combined_all_sql = `
    SELECT
        orders.order_id, orders.item, orders.quantity, orders.requests, menu.menu_id, menu.menu_item, menu.price, menu.calories, menu.description
    FROM
        orders
    INNER JOIN
        menu ON orders.item = menu.menu_item
`

app.get("/menu", (req, res ) => {
    db.execute(read_combined_all_sql, (error, results) => {
        if (error)
            res.status(500).send(error); //internal server error
        else
            res.render("menu", { inventory : results });
       
    })
})

const read_edit_menu_sql = `
    SELECT
        menu_id, menu_item, price, calories, description
    FROM
        menu
`

app.get( "/edit", ( req, res ) => {
    db.execute(read_edit_menu_sql, (error, results) => {
        if (error)
            res.status(500).send(error);
        else   
            res.render("menu_edit", { inventory : results });
    })
})

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

const delete_menu_sql = `
    DELETE
    FROM
        menu
    WHERE
        menu_id = ?
`

app.get("/edit/item/:id/delete", (req, res ) => {
    db.execute(delete_menu_sql, [req.params.id], ( error, results ) => {
        if (error)
            res.status(500).send(error);
        else {
            res.redirect("/edit");
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

const create_menu_sql = `
    INSERT INTO menu
        (menu_item, price, calories, description)
    VALUES
        (?, ?, ?, ?)
`

app.post("/edit", (req, res) => {
    db.execute(create_menu_sql, [req.body.menu, req.body.price, req.body.calories, req.body.description], (error, results) => {
        if (error)
            res.status(500).send(error); //internal server error
        else {
            res.redirect('/edit');
        }
    })
})

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
// SUM(orders.quantity*menu.price)
// possibly to sum above

//define a route for the item detail page
app.get( "/menu/item/:id", (req, res ) => {
    db.execute(read_combined_item_sql, [req.params.id], (error, results) => {
        if(error)
            res.status(500).send(error); //internal service error
        else if (results.length == 0)
            res.redirect('/menu/no_id_found');
        else {
            let data = results[0];
            console.log("successfully rendered");
            // console.log(data);
            res.render('item', data) //send item.ejs as html but use "data" as context for template to be rendered with
        }
        // res.send(results[0]);
    })
});

const read_edit_item_sql = `
    SELECT
        menu_id, menu_item, price, calories, description
    FROM
        menu
    WHERE
        menu_id = ?
`

app.get( "/edit/item/:id", (req, res ) => {
    db.execute(read_edit_item_sql, [req.params.id], (error, results) => {
        if(error)
            res.status(500).send(error); //internal service error
        else if (results.length == 0)
            res.redirect('/edit/no_id_found');
        else {
            let data = results[0];
            console.log("successfully rendered edit item page");

            res.render('menu_item_edit', data)
        }
    })
});

const update_item_sql = `
    UPDATE
        orders
    SET
        quantity = ?,
        requests = ?
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

const update_menu_sql = `
    UPDATE
        menu
    SET
        menu_item = ?,
        price = ?,
        calories = ?,
        description = ?
    WHERE
        menu_id = ?
`
app.post("/edit/item/:id", (req,res) => {
    db.execute(update_menu_sql, [req.body.menu, req.body.price, req.body.calories, req.body.description, req.params.id], (error, results) => {
        if (error)
            res.status(500).send(error); //internal server error
        else {
            res.redirect(`/edit/item/${req.params.id}`);
        }
    })
})

const order_success_sql = `
    READ
        customer_id, order, quantity
    FROM
        customers
    WHERE
        customer_id = ?
`

app.get("/success/:customer_id", (req, res) => {
    db.execute(order_success_sql, [req.params.customer_id], (error, results) => {
        if (error)
            res.status(500).send(error);
        else {
            let data = results[0];
            res.render('order_success', data)
        }
    })
})

// start the server
app.listen( port, () => {
    console.log(`App server listening on ${ port }. (Go to http://localhost:${ port })` );
} );