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
  secret: process.env.AUTH_SECRET,
  baseURL: process.env.AUTH_BASE_URL,
  clientID: process.env.AUTH_CLIENT_ID,
  issuerBaseURL: process.env.AUTH_ISSUER_BASE_URL
};

// auth router attaches /login, /logout, and /callback routes to the baseURL
app.use(auth(config));

//define middleware to handle POST requests (configure express to parse URL-encoded POST request bodies)
app.use( express.urlencoded({extended : false}));

// define middleware that logs all incoming requests
app.use(logger("dev"));

// define middleware that serves static resources in the public directory
app.use(express.static(__dirname + '/public'));

// admin permission check
const check_admin_permission_sql =`
    SELECT
        isAdmin
    FROM
        users
    WHERE
        email = ?
`

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

// use middleware and combining requiresAuth() on top to prevent excessive callback loops

// app.use(requiresAuth());
// middleware -> if authenticated, check if admin or not. Take result, attach later

// prevent and redirect users from attempting to order an item not available on the menu
app.get( "/menu/no_match", requiresAuth(), ( req, res ) => {
    db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
        if (error)
            res.status(500).send(error);
        else if (results[0].isAdmin == 1) {
            res.redirect("/admin")
        }
        else {
            res.render('no_match');
        }
    })
} );

// prevent and redirect users from attempting to view or edit an order that does not exist
app.get( "/menu/no_id_found", requiresAuth(), ( req, res ) => {
    db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
        if (error)
            res.status(500).send(error);
        else if (results[0].isAdmin == 1) {
            res.redirect("/admin")
        }
        else {
            res.render('no_order_id_found');
        }
    })
} );

// prevent and redirect admins from attempting to view or edit a menu item that does not exist
app.get( "/edit/no_id_found", requiresAuth(), ( req, res ) => {
    db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
        if (error)
            res.status(500).send(error);
        else if (results[0].isAdmin == 0) {
            res.redirect("/access_denied")
        }
        else {
            res.render('no_menu_id_found');
        }
    })
} );

// prevent and redirect users from attempting to access pages that require admin permissions
app.get( "/access_denied", requiresAuth(), ( req, res ) => {
    db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
        if (error)
            res.status(500).send(error);
        else if (results[0].isAdmin == 1) {
            res.redirect("/admin")
        }
        else {
            res.render('access_denied');
        }
    })
} );

// render all current orders for a particular user
const read_combined_all_sql = `
    SELECT
        orders.order_id, orders.item, orders.quantity, orders.requests, menu.menu_id, menu.menu_item, menu.price, menu.calories, menu.description
    FROM
        orders
    INNER JOIN
        menu ON orders.item = menu.menu_item
    WHERE
        email = ?
`

// render the summed price for each menu item ordered
const read_sum_sql =`
    SELECT
        SUM(orders.quantity*menu.price) sum 
    FROM 
        orders
    INNER JOIN
        menu ON orders.item = menu.menu_item
    WHERE
        email = ?
`

// adds new users into the users database by default when they first access
const add_user_sql=`
    INSERT INTO users
        (email, isAdmin)
    VALUES
        (?, 0)
`

// a check for whether the user exists in db
const check_user_match_sql = `
    SELECT
        email
    FROM
        users
    WHERE
        email = ?
`

//renders the menu ordering page and checks if logged in user is within the admin db

app.get("/menu", requiresAuth(), (req, res ) => {
    db.execute(check_user_match_sql, [req.oidc.user.email], (error, results) => {
        if (error)
            res.status(500).send(error);
        else {
            if (results.length == 0) {
                db.execute(add_user_sql, [req.oidc.user.email], (error) => {
                    if (error)
                        res.status(500).send(error);
                })
                console.log("added user to db");
            }
            else {
                console.log("user exists in db");
            }
            db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results2) => {
                if (error)
                    res.status(500).send(error);
                else if (results2[0].isAdmin == 1) {
                    res.redirect("/admin")
                    console.log("user is an admin");
                }
                else {
                    console.log("user is a user");
                    db.execute(read_combined_all_sql, [req.oidc.user.email], (error, results3) => {
                        if (error)
                            res.status(500).send(error);
                        else
                            db.execute(read_sum_sql, [req.oidc.user.email], (error, results4) => {
                                if (error)
                                    res.status(500).send(error); //internal server error
                                else {
                                    res.render('menu', { inventory : results3, username : req.oidc.user.name, sum : results4[0].sum });
                                    // console.log("render successful")
                                    } 
                            })
                    })
                }
            })
        }
    })
})

// render the users database on admin page
const read_admin_edit_sql = `
    SELECT
        user_id, email, isAdmin
    FROM
        users
`

app.get("/admin_edit", requiresAuth(), (req, res) => {
    db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
        if (error)
            res.status(500).send(error);
        else if (results[0].isAdmin == 0) {
            res.redirect("/access_denied")
        }
        else {
            db.execute(read_admin_edit_sql, (error, results) => {
                if (error)
                    res.status(500).send(error);
                else
                    res.render("admin_control", { userlist : results })
            })
        }
    })
})

// render the menu edit page for admins
const read_edit_menu_sql = `
    SELECT
        menu_id, menu_item, price, calories, description
    FROM
        menu
`

app.get( "/edit", requiresAuth(), ( req, res ) => {
    db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
        if (error)
            res.status(500).send(error);
        else if (results[0].isAdmin == 0) {
            res.redirect("/access_denied")
        }
        else {
            db.execute(read_edit_menu_sql, (error, results) => {
                if (error)
                    res.status(500).send(error);
                else   
                    res.render("menu_edit", { inventory : results });
            })
        }
    })
})

// render the main admin page with corresponding credentials for each admin
const read_admin_sql = `
    SELECT
        user_id, email, isAdmin
    FROM
        users
    WHERE
        email = ?
`

app.get( "/admin", requiresAuth(), (req, res) => {
    db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
        if (error)
            res.status(500).send(error);
        else if (results[0].isAdmin == 0) {
            res.redirect("/access_denied")
        }
        else {
            db.execute(read_admin_sql, [req.oidc.user.email], (error, results) => {
                if (error)
                    res.status(500).send(error);
                else
                    res.render("admin_main", { results, username: req.oidc.user.name})
        }) }
    })
})

// allow users to delete orders placed
const delete_orders_sql = `
    DELETE
    FROM
        orders
    WHERE
        order_id = ?
`

app.get("/menu/item/:id/delete", requiresAuth(), (req, res ) => {
    db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
        if (error)
            res.status(500).send(error);
        else if (results[0].isAdmin == 1) {
            res.redirect("/admin")
        }
        else {
            db.execute(delete_orders_sql, [req.params.id], ( error, results ) => {
                if (error)
                    res.status(500).send(error);
                else {
                    res.redirect("/menu");
                }
            })
        }
    })
})

// allow admins to delete menu items from current menu
const delete_menu_sql = `
    DELETE
    FROM
        menu
    WHERE
        menu_id = ?
`

app.get("/edit/item/:id/delete", requiresAuth(), (req, res) => {
    db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
        if (error)
            res.status(500).send(error);
        else if (results[0].isAdmin == 0) {
            res.redirect("/access_denied")
        }
        else {
            db.execute(delete_menu_sql, [req.params.id], ( error, results ) => {
                if (error)
                    res.status(500).send(error);
                else {
                    res.redirect("/edit");
                }
            })
        }
    })
})

// allow admins to delete user information saved on the database
const delete_user_sql=`
    DELETE
    FROM
        users
    WHERE
        user_id = ?
`

app.get("/admin_edit/:id/delete", requiresAuth(), (req, res) => {
    db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
        if (error)
            res.status(500).send(error);
        else if (results[0].isAdmin == 0) {
            res.redirect("/access_denied")
        }
        else {
            db.execute(delete_user_sql, [req.params.id], (error, results) => {
                if (error)
                    res.status(500).send(error);
                else {
                    res.redirect("/admin_edit");
                }
            })
        }
    })
})

// allow admins to promote users into admins
const promote_admin_sql=`
    UPDATE
        users
    SET
        isAdmin = 1
    WHERE
        user_id = ?
`

app.get("/admin_edit/:id/promote", requiresAuth(), (req, res) => {
    db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
        if (error)
            res.status(500).send(error);
        else if (results[0].isAdmin == 0) {
            res.redirect("/access_denied")
        }
        else {
            db.execute(promote_admin_sql, [req.params.id], (error, results) => {
                if (error)
                    res.status(500).send(error);
                else {
                    res.redirect("/admin_edit");
                }
            })
        }
    })
})

// allow *certain* admins to demote other admins back to a user
const demote_admin_sql=`
    UPDATE
        users
    SET
        isAdmin = 0
    WHERE
        user_id = ?
`

app.get("/admin_edit/:id/demote", requiresAuth(), (req, res) => {
    db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
        if (error)
            res.status(500).send(error);
        else if (results[0].isAdmin == 0) {
            res.redirect("/access_denied")
        }
        else {
            db.execute(demote_admin_sql, [req.params.id], (error, results) => {
                if (error)
                    res.status(500).send(error);
                else {
                    res.redirect("/admin_edit");
                }
            })
        }
    })
})

// place new orders for users
const create_item_sql = `
INSERT INTO orders
    (item, quantity, requests, email)
VALUES
    (?, ?, ?, ?)
`

// a check to ensure that the selected menu item exists on the current menu
const check_item_match_sql = `
    SELECT
        menu_item
    FROM
        menu
    WHERE
        menu_item = ?
`

// allows users to place new orders after checking that the selected item exists on the current menu
app.post("/menu", requiresAuth(), (req, res) => {
    db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
        if (error)
            res.status(500).send(error);
        else if (results[0].isAdmin == 1) {
            res.redirect("/admin")
        }
        else {
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
                db.execute(create_item_sql, [req.body.item, req.body.quantity, req.body.requests, req.oidc.user.email], (error, results) => {
                    if (error)
                        res.status(500).send(error); //internal server error
                    else {
                        res.redirect('/menu');
                    }
                })
            }
        })
        }
    })
})

// allow admins to create new menu items
const create_menu_sql = `
    INSERT INTO menu
        (menu_item, price, calories, description)
    VALUES
        (?, ?, ?, ?)
`

app.post("/edit", requiresAuth(), (req, res) => {
    db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
        if (error)
            res.status(500).send(error);
        else if (results[0].isAdmin == 0) {
            res.redirect("/access_denied")
        }
        else {
            db.execute(create_menu_sql, [req.body.menu, req.body.price, req.body.calories, req.body.description], (error, results) => {
                if (error)
                    res.status(500).send(error); //internal server error
                else {
                    res.redirect('/edit');
                }
            })
        }
    })
})

// render each item with parameters
const read_combined_item_sql =`
    SELECT
        orders.order_id, orders.item, orders.quantity, orders.requests, menu.menu_id, menu.menu_item, menu.price, menu.calories, menu.description
    FROM
        orders
    INNER JOIN
        menu ON orders.item = menu.menu_item
    WHERE
        orders.order_id = ?
        AND email = ?
`
// SUM(orders.quantity*menu.price)
// possibly to sum above

//define a route for the item detail page
app.get( "/menu/item/:id", requiresAuth(), (req, res ) => {
    db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
        if (error)
            res.status(500).send(error);
        else if (results[0].isAdmin == 1) {
            res.redirect("/admin")
        }
        else {
            db.execute(read_combined_item_sql, [req.params.id, req.oidc.user.email], (error, results) => {

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
        }
    })
})

// render each item edit page with parameters
const read_edit_item_sql = `
    SELECT
        menu_id, menu_item, price, calories, description
    FROM
        menu
    WHERE
        menu_id = ?
`

app.get( "/edit/item/:id", requiresAuth(), (req, res ) => {
    db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
        if (error)
            res.status(500).send(error);
        else if (results[0].isAdmin == 0) {
            res.redirect("/access_denied")
        }
        else {
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
        }
    })
});

// allow users to update order details for each item
const update_item_sql = `
    UPDATE
        orders
    SET
        quantity = ?,
        requests = ?,
        email = ?
    WHERE
        order_id = ?
`

app.post("/menu/item/:id", requiresAuth(), (req,res) => {
    db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
        if (error)
            res.status(500).send(error);
        else if (results[0].isAdmin == 1) {
            res.redirect("/admin")
        }
        else {
            db.execute(update_item_sql, [req.body.quantity, req.body.request, req.oidc.user.email, req.params.id], (error, results) => {
                if (error)
                    res.status(500).send(error); //internal server error
                else {
                    res.redirect(`/menu/item/${req.params.id}`);
                }
            })
        }
    })
})

// allow admins to update item details for each menu item
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
app.post("/edit/item/:id", requiresAuth(), (req,res) => {
    db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
        if (error)
            res.status(500).send(error);
        else if (results[0].isAdmin == 0) {
            res.redirect("/access_denied")
        }
        else {
            db.execute(update_menu_sql, [req.body.menu, req.body.price, req.body.calories, req.body.description, req.params.id], (error, results) => {
                if (error)
                    res.status(500).send(error); //internal server error
                else {
                    res.redirect(`/edit/item/${req.params.id}`);
                }
            })
        }
    })    
})

// const order_success_sql = `
//     READ
//         customer_id, order, quantity
//     FROM
//         customers
//     WHERE
//         customer_id = ?
// `

// show customer receipt during checkout and post-order

const read_receipt_sql =`
    SELECT
        orders.order_id, orders.item, orders.quantity, menu.menu_id, menu.menu_item, menu.price
    FROM
        orders
    INNER JOIN
        menu ON orders.item = menu.menu_item
    WHERE
        email = ?
`

const read_receipt_sum_sql =`
    SELECT
        SUM(orders.quantity*menu.price) sum 
    FROM 
        orders
    INNER JOIN
        menu ON orders.item = menu.menu_item
    WHERE
        email = ?
`

// renders the receipt during the checkout page as confirmation
app.get("/checkout", requiresAuth(), (req, res) => {
    db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
        if (error)
            res.status(500).send(error);
        else if (results[0].isAdmin == 1) {
            res.redirect("/admin")
        }
        else {
            db.execute(read_receipt_sql, [req.oidc.user.email], (error, results) => {
                if (error)
                    res.status(500).send(error);
                else {
                    db.execute(read_receipt_sum_sql, [req.oidc.user.email], (error, results2) => {
                        if (error)
                            res.status(500).send(error);
                        else {
                            console.log(results)
                            console.log(results2[0].sum)
                            res.render('checkout', {inventory : results, sum : results2[0].sum })
                            
                        }
                    })
                }
            })
        }
    })
})

// renders the receipt again, but as reference post-order
app.get("/success", requiresAuth(), (req, res) => {
    db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
        if (error)
            res.status(500).send(error);
        else if (results[0].isAdmin == 1) {
            res.redirect("/admin")
        }
        else {
            db.execute(read_receipt_sql, [req.oidc.user.email], (error, results) => {
                if (error)
                    res.status(500).send(error);
                else {
                    db.execute(read_receipt_sum_sql, [req.oidc.user.email], (error, results2) => {
                        if (error)
                            res.status(500).send(error);
                        else {
                            console.log(results)
                            console.log(results2[0].sum)
                            res.render('order_success', {inventory : results, sum : results2[0].sum })
                            
                        }
                    })
                }
            })
        }
    })
})

// rendering order history viewable by individual users
app.get("/user_history", requiresAuth(), (req, res) => { 
    db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
        if (error)
            res.status(500).send(error);
        else if (results[0].isAdmin == 1) {
            res.redirect("/admin")
        }
        else {
            db.execute(read_user_history_sql, [req.oidc.user.email], (error, results) => {
                if (error)
                    res.status(500).send(error);
                else {
                    res.render('order_history_user', {inventory: results})
                }
            })
        }
    })
})

// rendering order history for a specified user by admins

// rendering the complete order history for all users


// start the server
app.listen( port, () => {
    console.log(`App server listening on ${ port }. (Go to http://localhost:${ port })` );
} );