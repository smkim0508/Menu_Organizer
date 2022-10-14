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

let db;
try {
    (async () => {
        db = await require('./db/db_pool');
    })()
} catch (err) {
    console.log(`Error while establishing connection, ${err}`);
}

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
const { format } = require("mysql2");

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
app.get( "/menu/no_match", requiresAuth(), async ( req, res ) => {
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }

        res.render("no_match");

    } catch (err) {
        res.status(500).send(err.message);
    }
    // db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
    //     if (error)
    //         res.status(500).send(error);
    //     else if (results[0].isAdmin == 1) {
    //         res.redirect("/admin")
    //     }
    //     else {
    //         res.render('no_match');
    //     }
    // })
} );

// prevent and redirect users from attempting to view or edit an order that does not exist
app.get( "/menu/no_id_found", requiresAuth(), async ( req, res ) => {
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }

        res.render("no_order_id_found");

    } catch (err) {
        res.status(500).send(err.message);
    }
    // db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
    //     if (error)
    //         res.status(500).send(error);
    //     else if (results[0].isAdmin == 1) {
    //         res.redirect("/admin")
    //     }
    //     else {
    //         res.render('no_order_id_found');
    //     }
    // })
} );

// prevent and redirect admins from attempting to view or edit a menu item that does not exist
app.get( "/edit/no_id_found", requiresAuth(), async ( req, res ) => {
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }
        let [isAdmin, _i] = await db.execute(check_admin_permission_sql, [req.oidc.user.email]);
        if (isAdmin[0].isAdmin == 0) {
            res.redirect("/access_denied")
        }

        res.render("no_menu_id_found");

    } catch (err) {
        res.status(500).send(err.message);
    }
    // db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
    //     if (error)
    //         res.status(500).send(error);
    //     else if (results[0].isAdmin == 0) {
    //         res.redirect("/access_denied")
    //     }
    //     else {
    //         res.render('no_menu_id_found');
    //     }
    // })
} );

// prevent and redirect users from attempting to access pages that require admin permissions
app.get( "/access_denied", requiresAuth(), async ( req, res ) => {
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }

        res.render("access_denied");

    } catch (err) {
        res.status(500).send(err.message);
    }
    // db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
    //     if (error)
    //         res.status(500).send(error);
    //     else if (results[0].isAdmin == 1) {
    //         res.redirect("/admin")
    //     }
    //     else {
    //         res.render('access_denied');
    //     }
    // })
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
const read_menu_sql = `
    SELECT
        menu_id, menu_item, price, calories, description, numAvail
    FROM
        menu
`

// adds new users into the users database by default when they first access
const add_user_sql=`
    INSERT INTO 
        users (username, email, isAdmin)
    VALUES
        (?, ?, 0)
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
// display "order has been filled for this week" if the number of incompleted orders exceed a certain quota

// counts the number of incompleted orders
// const count_number_incompleted_orders = `
//     SELECT 
//         status.isComplete, status.item, status.quantity
//     FROM
//         status
//     INNER JOIN
//         orders ON orders.item = status.item
//     WHERE
//         status.isComplete = 0
//         AND
//         orders.item = ?
// `
const count_number_incompleted_orders = `
    SELECT 
        status.isComplete, status.item, SUM (status.quantity) sum
    FROM
        status
    WHERE
        isComplete = 0
        AND
        item = ?
`
// counts the number of designated orders taken per week
const read_orderBy_sql = `
    SELECT
        orderBy
    FROM
        settings
`

//renders the menu and the ordering page and checks if logged in user is within the admin db and checks for the number of completed orders for the week

app.get("/menu", requiresAuth(), async (req, res) => {
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }

        let [menu, _m] = await db.execute(read_menu_sql);
        let numIncomplete = [];
        for (let i = 0; i < menu.length; i++) {
            let [incomplete_orders, _o] = await db.execute(count_number_incompleted_orders, [menu[i].menu_item]);
            if (incomplete_orders[0].sum == null) {
                numIncomplete[i] = 0;
            } else {
                numIncomplete[i] = incomplete_orders[0].sum
            }
        }
        let [read_orders, _r] = await db.execute(read_combined_all_sql, [req.oidc.user.email]);
        let [read_sum, _s] = await db.execute(read_sum_sql, [req.oidc.user.email]);
        let [orderBy, _by] = await db.execute(read_orderBy_sql);
        res.render('menu', { orders: read_orders, menu: menu, username: req.oidc.user.name, sum: read_sum[0].sum, orderBy: orderBy[0].orderBy, incompleteOrders: numIncomplete })
    } catch (err) {
        res.status(500).send(err.message);
    }

    // db.execute(check_user_match_sql, [req.oidc.user.email], (error, results) => {
    //     if (error)
    //         res.status(500).send(error);
    //     else {
    //         if (results.length == 0) {
    //             db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email], (error) => {
    //                 if (error)
    //                     res.status(500).send(error);
    //             })
    //             console.log("added user to db");
    //         }
    //         else {
    //             console.log("user exists in db");
    //         }
    //         db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results2) => {
    //             if (error)
    //                 res.status(500).send(error);
    //             else if (results2[0].isAdmin == 1) {
    //                 res.redirect("/admin")
    //                 console.log("user is an admin");
    //             }
    //             else {
    //                 console.log("user is a user");
    //                 db.execute(read_menu_sql, (error, currMenu) => {
    //                     // console.log(currMenu)
    //                     if (error)
    //                         res.status(500).send(error);
    //                     else {
    //                         let numIncomplete = [];
    //                         // const numIncomplete = new Array(currMenu.length).fill(0);
    //                         for (let i = 0; i < currMenu.length; i++) {
    //                             // console.log(currMenu.length)
    //                             db.execute(count_number_incompleted_orders, [currMenu[i].menu_item], (error, num) => {
    //                                 if (error)
    //                                     res.status(500).send(error);
    //                                 else {
    //                                     if (num[0].sum == null) {
    //                                         numIncomplete[i] = 0;
    //                                     }
    //                                     else {
    //                                         numIncomplete[i] = num[0].sum;
    //                                     }
    //                                     // console.log(num[0].sum)
    //                                 }
    //                             })

    //                         }
    //                         db.execute(read_combined_all_sql, [req.oidc.user.email], (error, results3) => {
    //                             if (error)
    //                                 res.status(500).send(error);
    //                             else {
    //                                 db.execute(read_sum_sql, [req.oidc.user.email], (error, results4) => {
    //                                     if (error)
    //                                         res.status(500).send(error);
    //                                     else {
    //                                         db.execute(read_orderBy_sql, (error, results5) => {
    //                                             if (error)
    //                                                 res.status(500).send(error);
    //                                             else {
    //                                                 // console.log(numIncomplete)
    //                                                 // console.log(currMenu)
    //                                                 res.render('menu', { orders : results3, menu : currMenu, username : req.oidc.user.name, sum : results4[0].sum, orderBy: results5[0].orderBy, incompleteOrders : numIncomplete });
    //                                             }
    //                                         })
    //                                     }
    //                                 })
    //                             }
    //                         })
    //                     }
    //                 })
    //             }
    //         })
    //     }
    // })
})

// render the users database on admin page
const read_admin_edit_sql = `
    SELECT
        user_id, username, email, isAdmin
    FROM
        users
`


app.get("/admin_edit", requiresAuth(), async (req, res) => {
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }
        let [isAdmin, _i] = await db.execute(check_admin_permission_sql, [req.oidc.user.email]);
        if (isAdmin[0].isAdmin == 0) {
            res.redirect("/access_denied")
        }

        let [user_info, _info] = await db.execute(read_admin_edit_sql);
        res.render("admin_control", { userlist: user_info });

    } catch (err) {
        res.status(500).send(err.message);
    }
    // db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
    //     if (error)
    //         res.status(500).send(error);
    //     else if (results[0].isAdmin == 0) {
    //         res.redirect("/access_denied")
    //     }
    //     else {
    //         db.execute(read_admin_edit_sql, (error, results) => {
    //             if (error)
    //                 res.status(500).send(error);
    //             else
    //                 res.render("admin_control", { userlist : results })
    //         })
    //     }
    // })
})

// render the menu edit page for admins
const read_edit_menu_sql = `
    SELECT
        menu_id, menu_item, price, calories, description, numAvail
    FROM
        menu
`

app.get( "/edit", requiresAuth(), async (req, res) => {
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }
        let [isAdmin, _i] = await db.execute(check_admin_permission_sql, [req.oidc.user.email]);
        if (isAdmin[0].isAdmin == 0) {
            res.redirect("/access_denied")
        }
        
        let [menu, _m] = await db.execute(read_edit_menu_sql);
        let [orderBy, _o] = await db.execute(read_orderBy_sql);

        res.render("menu_edit", { menu: menu, orderBy: orderBy[0].orderBy })

    } catch (err) {
        res.status(500).send(err.message);
    }
    // db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
    //     if (error)
    //         res.status(500).send(error);
    //     else if (results[0].isAdmin == 0) {
    //         res.redirect("/access_denied")
    //     }
    //     else {
    //         db.execute(read_edit_menu_sql, (error, results) => {
    //             if (error)
    //                 res.status(500).send(error);
    //             else  {
    //                 db.execute(read_orderBy_sql, (error, results2) => {
    //                     if (error)
    //                         res.status(500).send(error);
    //                     else {
    //                         res.render("menu_edit", { menu : results, orderBy: results2[0].orderBy });
    //                     }
    //                 })
    //             }     
    //         })
    //     }
    // })
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

app.get( "/admin", requiresAuth(), async (req, res) => {
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }
        let [isAdmin, _i] = await db.execute(check_admin_permission_sql, [req.oidc.user.email]);
        if (isAdmin[0].isAdmin == 0) {
            res.redirect("/access_denied")
        }

        // let [admin, _a] = await db.execute(read_admin_sql, [req.oidc.user.email]);

        res.render("admin_main", { username: req.oidc.user.name })
        
    } catch (err) {
        res.status(500).send(err.message);
    }
    // db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
    //     if (error)
    //         res.status(500).send(error);
    //     else if (results[0].isAdmin == 0) {
    //         res.redirect("/access_denied")
    //     }
    //     else {
    //         db.execute(read_admin_sql, [req.oidc.user.email], (error, results) => {
    //             if (error)
    //                 res.status(500).send(error);
    //             else
    //                 res.render("admin_main", { results, username: req.oidc.user.name})
    //     }) }
    // })
})

// allow users to delete orders placed
const delete_orders_sql = `
    DELETE
    FROM
        orders
    WHERE
        order_id = ?
`

app.get("/menu/item/:id/delete", requiresAuth(), async (req, res ) => {
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }

        await db.execute(delete_orders_sql, [req.params.id]);

        res.redirect("/menu");

    } catch (err) {
        res.status(500).send(err.message);
    }
    // db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
    //     if (error)
    //         res.status(500).send(error);
    //     else if (results[0].isAdmin == 1) {
    //         res.redirect("/admin")
    //     }
    //     else {
    //         db.execute(delete_orders_sql, [req.params.id], ( error, results ) => {
    //             if (error)
    //                 res.status(500).send(error);
    //             else {
    //                 res.redirect("/menu");
    //             }
    //         })
    //     }
    // })
})

// allow admins to delete menu items from current menu
const delete_menu_sql = `
    DELETE
    FROM
        menu
    WHERE
        menu_id = ?
`

app.get("/edit/item/:id/delete", requiresAuth(), async (req, res) => {
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }
        let [isAdmin, _i] = await db.execute(check_admin_permission_sql, [req.oidc.user.email]);
        if (isAdmin[0].isAdmin == 0) {
            res.redirect("/access_denied")
        }

        await db.execute(delete_menu_sql, [req.params.id]);

        res.redirect("/edit");

    } catch (err) {
        res.status(500).send(err.message);
    }
    // db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
    //     if (error)
    //         res.status(500).send(error);
    //     else if (results[0].isAdmin == 0) {
    //         res.redirect("/access_denied")
    //     }
    //     else {
    //         db.execute(delete_menu_sql, [req.params.id], ( error, results ) => {
    //             if (error)
    //                 res.status(500).send(error);
    //             else {
    //                 res.redirect("/edit");
    //             }
    //         })
    //     }
    // })
})

// allow admins to delete user information saved on the database
const delete_user_sql=`
    DELETE
    FROM
        users
    WHERE
        user_id = ?
`

app.get("/admin_edit/:id/delete", requiresAuth(), async (req, res) => {
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }
        let [isAdmin, _i] = await db.execute(check_admin_permission_sql, [req.oidc.user.email]);
        if (isAdmin[0].isAdmin == 0) {
            res.redirect("/access_denied")
        }
        
        await db,execute(delete_user_sql, [req.params.id]);

        res.redirect("/admin_edit");

    } catch (err) {
        res.status(500).send(err.message);
    }
    // db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
    //     if (error)
    //         res.status(500).send(error);
    //     else if (results[0].isAdmin == 0) {
    //         res.redirect("/access_denied")
    //     }
    //     else {
    //         db.execute(delete_user_sql, [req.params.id], (error, results) => {
    //             if (error)
    //                 res.status(500).send(error);
    //             else {
    //                 res.redirect("/admin_edit");
    //             }
    //         })
    //     }
    // })
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

app.get("/admin_edit/:id/promote", requiresAuth(), async (req, res) => {
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }
        let [isAdmin, _i] = await db.execute(check_admin_permission_sql, [req.oidc.user.email]);
        if (isAdmin[0].isAdmin == 0) {
            res.redirect("/access_denied")
        }
        
        await db.execute(promote_admin_sql, [req.params.id]);

        res.redirect("/admin_edit");

    } catch (err) {
        res.status(500).send(err.message);
    }
    // db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
    //     if (error)
    //         res.status(500).send(error);
    //     else if (results[0].isAdmin == 0) {
    //         res.redirect("/access_denied")
    //     }
    //     else {
    //         db.execute(promote_admin_sql, [req.params.id], (error, results) => {
    //             if (error)
    //                 res.status(500).send(error);
    //             else {
    //                 res.redirect("/admin_edit");
    //             }
    //         })
    //     }
    // })
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

app.get("/admin_edit/:id/demote", requiresAuth(), async (req, res) => {
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }
        let [isAdmin, _i] = await db.execute(check_admin_permission_sql, [req.oidc.user.email]);
        if (isAdmin[0].isAdmin == 0) {
            res.redirect("/access_denied")
        }
        
        await db.execute(demote_admin_sql, [req.params.id]);

        res.redirect("/admin_edit");

    } catch (err) {
        res.status(500).send(err.message);
    }
    // db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
    //     if (error)
    //         res.status(500).send(error);
    //     else if (results[0].isAdmin == 0) {
    //         res.redirect("/access_denied")
    //     }
    //     else {
    //         db.execute(demote_admin_sql, [req.params.id], (error, results) => {
    //             if (error)
    //                 res.status(500).send(error);
    //             else {
    //                 res.redirect("/admin_edit");
    //             }
    //         })
    //     }
    // })
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
app.post("/menu", requiresAuth(), async (req, res) => {
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }
        let [isAdmin, _i] = await db.execute(check_admin_permission_sql, [req.oidc.user.email]);
        if (isAdmin[0].isAdmin == 0) {
            res.redirect("/access_denied")
        }

        let [results, _r] = await db.execute(check_item_match_sql, [req.body.item]);
        if (results.length == 0) {
            res.redirect("/menu/no_match");
        }
        await db.execute(create_item_sql, [req.body.item, req.body.quantity, req.body.requests, req.oidc.user.email]);

        res.redirect("/menu");

    } catch (err) {
        res.status(500).send(err.message);
    }
    // db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
    //     if (error)
    //         res.status(500).send(error);
    //     else if (results[0].isAdmin == 1) {
    //         res.redirect("/admin")
    //     }
    //     else {
    //         // follows the "name" specified in the form function
    //     // req.body.item
    //     // req.body.quantity
    //     db.execute(check_item_match_sql, [req.body.item], (error, results) => {
    //         if (error)
    //             res.status(500).send(error); //internal server error
    //         else if (results.length == 0)
    //             // res.status(404).send(`Please choose an item from the menu!`)
    //             res.redirect('/menu/no_match');
    //         else {
    //             db.execute(create_item_sql, [req.body.item, req.body.quantity, req.body.requests, req.oidc.user.email], (error, results) => {
    //                 if (error)
    //                     res.status(500).send(error); //internal server error
    //                 else {
    //                     res.redirect('/menu');
    //                 }
    //             })
    //         }
    //     })
    //     }
    // })
})

// allow admins to create new menu items
const create_menu_sql = `
    INSERT INTO menu
        (menu_item, price, calories, description, numAvail)
    VALUES
        (?, ?, ?, ?, ?)
`

app.post("/edit", requiresAuth(), async (req, res) => {
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }
        let [isAdmin, _i] = await db.execute(check_admin_permission_sql, [req.oidc.user.email]);
        if (isAdmin[0].isAdmin == 0) {
            res.redirect("/access_denied")
        }
        // console.log(req);
        await db.execute(create_menu_sql, [req.body.menu, req.body.price, req.body.calories, req.body.description, req.body.numAvail]);

        res.redirect("/edit");
        
    } catch (err) {
        res.status(500).send(err.message);
    }
    // db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
    //     if (error)
    //         res.status(500).send(error);
    //     else if (results[0].isAdmin == 0) {
    //         res.redirect("/access_denied")
    //     }
    //     else {
    //         db.execute(create_menu_sql, [req.body.menu, req.body.price, req.body.calories, req.body.description, req.body.numAvail], (error, results) => {
    //             if (error)
    //                 res.status(500).send(error); //internal server error
    //             else {
    //                 res.redirect('/edit');
    //             }
    //         })
    //     }
    // })
})

// update the date that current set of orders are due by

const update_orderBy_sql =`
    UPDATE
        settings
    SET
        orderBy = ?
`

// combine with app.post above

// app.post("/edit", requiresAuth(), async (req, res) => {
//     console.log("hi")
//     db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
//         if (error)
//             res.status(500).send(error);
//         else if (results[0].isAdmin == 0) {
//             res.redirect("/access_denied")
//         }
//         else {
//             db.execute(update_orderBy_sql, [req.body.orderBy], (error) => {
//                 if (error)
//                     res.status(500).send(error);
//                 else {
//                     console.log("success")
//                     res.redirect('/edit');
//                 }
//             })
//         }
//     })
// })

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
app.get( "/menu/item/:id", requiresAuth(), async (req, res ) => {
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }
        
        let [item_detail, _i] = await db.execute(read_combined_item_sql, [req.params.id, req.oidc.user.email]);
        if (item_detail.length == 0) {
            res.redirect("/menu/no_id_found");
        }
        
        res.render("item", item_detail[0]);
        
    } catch (err) {
        res.status(500).send(err.message);
    }
    // db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
    //     if (error)
    //         res.status(500).send(error);
    //     else if (results[0].isAdmin == 1) {
    //         res.redirect("/admin")
    //     }
    //     else {
    //         db.execute(read_combined_item_sql, [req.params.id, req.oidc.user.email], (error, results) => {

    //             if(error)
    //                 res.status(500).send(error); //internal service error
    //             else if (results.length == 0)
    //                 res.redirect('/menu/no_id_found');
    //             else {
    //                 let data = results[0];
    //                 console.log("successfully rendered");
    //                 // console.log(data);
    //                 res.render('item', data) //send item.ejs as html but use "data" as context for template to be rendered with
    //             }
    //             // res.send(results[0]);
    //         })
    //     }
    // })
})

// render each item edit page with parameters
const read_edit_item_sql = `
    SELECT
        menu_id, menu_item, price, calories, description, numAvail
    FROM
        menu
    WHERE
        menu_id = ?
`

app.get( "/edit/item/:id", requiresAuth(), async (req, res ) => {
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }
        let [isAdmin, _i] = await db.execute(check_admin_permission_sql, [req.oidc.user.email]);
        if (isAdmin[0].isAdmin == 0) {
            res.redirect("/access_denied")
        }

        let [item_detail, _d] = await db.execute(read_edit_item_sql, [req.params.id]);
        if (item_detail.length == 0) {
            res.redirect("/edit/no_id_found");
        }

        res.render("menu_item_edit", { detail: item_detail[0] });
        console.log(item_detail[0]);
        
    } catch (err) {
        res.status(500).send(err.message);
    }
    // db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
    //     if (error)
    //         res.status(500).send(error);
    //     else if (results[0].isAdmin == 0) {
    //         res.redirect("/access_denied")
    //     }
    //     else {
    //         db.execute(read_edit_item_sql, [req.params.id], (error, results) => {
    //             if(error)
    //                 res.status(500).send(error); //internal service error
    //             else if (results.length == 0)
    //                 res.redirect('/edit/no_id_found');
    //             else {
    //                 let data = results[0];
    //                 console.log("successfully rendered edit item page");
        
    //                 res.render('menu_item_edit', data)
    //             }
    //         })
    //     }
    // })
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

app.post("/menu/item/:id", requiresAuth(), async (req,res) => {
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }
        
        await db.execute(update_item_sql, [req.body.quantity, req.body.request, req.oidc.user.email, req.params.id]);

        res.redirect("/menu/item/${req.params.id}")
        
    } catch (err) {
        res.status(500).send(err.message);
    }
    // db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
    //     if (error)
    //         res.status(500).send(error);
    //     else if (results[0].isAdmin == 1) {
    //         res.redirect("/admin")
    //     }
    //     else {
    //         db.execute(update_item_sql, [req.body.quantity, req.body.request, req.oidc.user.email, req.params.id], (error, results) => {
    //             if (error)
    //                 res.status(500).send(error); //internal server error
    //             else {
    //                 res.redirect(`/menu/item/${req.params.id}`);
    //             }
    //         })
    //     }
    // })
})

// allow admins to update item details for each menu item
const update_menu_sql = `
    UPDATE
        menu
    SET
        menu_item = ?,
        price = ?,
        calories = ?,
        description = ?,
        numAvail = ?
    WHERE
        menu_id = ?
`
app.post("/edit/item/:id", requiresAuth(), async (req,res) => {
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }
        let [isAdmin, _i] = await db.execute(check_admin_permission_sql, [req.oidc.user.email]);
        if (isAdmin[0].isAdmin == 0) {
            res.redirect("/access_denied")
        }
        
        await db.execute(update_menu_sql, [req.body.menu, req.body.price, req.body.calories, req.body.description, req.body.numAvail, req.params.id]);

        res.redirect("/edit/item/${req.params.id}");

    } catch (err) {
        res.status(500).send(err.message);
    }
    // db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
    //     if (error)
    //         res.status(500).send(error);
    //     else if (results[0].isAdmin == 0) {
    //         res.redirect("/access_denied")
    //     }
    //     else {
    //         db.execute(update_menu_sql, [req.body.menu, req.body.price, req.body.calories, req.body.description, req.body.numAvail, req.params.id], (error, results) => {
    //             if (error)
    //                 res.status(500).send(error); //internal server error
    //             else {
    //                 res.redirect(`/edit/item/${req.params.id}`);
    //             }
    //         })
    //     }
    // })    
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
        orders.order_id, orders.item, orders.quantity, orders.requests, menu.menu_id, menu.menu_item, menu.price, menu.numAvail
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

const read_num_menu_sql =`
    SELECT
        menu_item, numAvail
    FROM
        menu
`

const record_order_history_sql =`
    INSERT INTO 
        status (username, email, item, quantity, requests, isComplete)
    VALUES
        (?, ?, ?, ?, ?, ?)
`

// adjusted sql for when the user gives no special requests
const record_order_history_sql_null =`
    INSERT INTO 
        status (username, email, item, quantity, isComplete)
    VALUES
        (?, ?, ?, ?, ?)
`

// check if the item ordered is available
const check_item_availability_sql =`
    SELECT
        item
    FROM
        orders
    WHERE
        item = ?
        AND
        email = ?
`
// renders the receipt during the checkout page as confirmation if the order for the week has not been filled yet
app.get("/checkout", requiresAuth(), async (req, res) => {
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }
        
        let [receipt, _r] = await db.execute(read_receipt_sql, [req.oidc.user.email]);
        let [sum, _s] = await db.execute(read_receipt_sum_sql, [req.oidc.user.email]);

        let [menu, _m] = await db.execute(read_num_menu_sql, [req.oidc.user.email]);
        let numIncomplete = [];
        let temp = [];

        for (let i=0; i<menu.length; i++) {
            let [incomplete_orders, _incomplete] = await db.execute(count_number_incompleted_orders, [menu[i].menu_item]);
            let [availability, _a] = await db.execute(check_item_availability_sql, [menu[i].menu_item, req.oidc.user.email]);
            if (incomplete_orders[0].sum == null) {
                numIncomplete[i] = 0;
            }
            else {
                numIncomplete[i] = incomplete_orders[0].sum
            }
            if (numIncomplete[i] >= menu[i].numAvail && availability.length > 0) {
                temp[i] = menu[i].menu_item;
            }
        }

        if (temp.length > 0) {
            res.redirect("/order_filled");
        }
        else {
            res.render("checkout", { receipt: receipt, sum: sum[0].sum });
        }
    
    } catch (err) {
        res.status(500).send(err.message);
    }
    // db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
    //     if (error)
    //         res.status(500).send(error);
    //     else if (results[0].isAdmin == 1) {
    //         res.redirect("/admin")
    //     }
    //     else {
    //         db.execute(read_num_menu_sql, [req.oidc.user.email], (error, currMenu) => {
    //             if (error)
    //                 res.status(500).send(error);
    //             else {
    //                 let numIncomplete = [];
    //                 let temp = [];
    //                 // console.log(currMenu.length)
    //                 for (let i = 0; i < currMenu.length; i++) {
    //                     // console.log(currMenu)
    //                     db.execute(count_number_incompleted_orders, [currMenu[i].menu_item], (error, num) => {
    //                         if (error)
    //                             res.status(500).send(error);
    //                         else {
    //                             db.execute(check_item_availability_sql, [currMenu[i].menu_item, req.oidc.user.email], (error, count) => {
    //                                 // console.log(count)
    //                                 if (error)
    //                                     res.status(500).send(error);
    //                                 else {
    //                                     if (num[0].sum == null) {
    //                                         numIncomplete[i] = 0;
    //                                     }
    //                                     else {
    //                                         numIncomplete[i] = num[0].sum;
    //                                     }
    //                                     if (numIncomplete[i] >= currMenu[i].numAvail && count.length > 0) {
    //                                             temp[i] = currMenu[i].menu_item;
    //                                     }
    //                                 }
    //                                 // console.log("1")
    //                             })
    //                         }
    //                         // console.log("2")
    //                     })
    //                 }
    //                 // console.log("3")
    //                 db.execute(read_receipt_sql, [req.oidc.user.email], (error, results3) => {
    //                     if (error)
    //                         res.status(500).send(error);
    //                     else {
    //                         db.execute(read_receipt_sum_sql, [req.oidc.user.email], (error, results4) => {
    //                             if (error)
    //                                 res.status(500).send(error);
    //                             else {
    //                                 if (temp.length > 0) {
    //                                     res.redirect('/order_filled');
    //                                 }
    //                                 else {
    //                                     // console.log("4")
    //                                     res.render('checkout', { receipt : results3, sum : results4[0].sum })
    //                                 }
    //                             }
    //                         }) 
    //                     }
    //                 })
    //             }   
    //         })
    //     }
    // })
})

// renders the receipt again, but as reference post-order
app.get("/success", requiresAuth(), async (req, res) => {
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }

        let [receipt, _r] = await db.execute(read_receipt_sql, [req.oidc.user.email]);
        let [sum, _s] = await db.execute(read_receipt_sum_sql, [req.oidc.user.email]);
        for (let i=0; i<receipt.length; i++) {
            if (receipt[i].requests == null) {
                await db.execute(record_order_history_sql_null, [req.oidc.user.name, req.oidc.user.email, receipt[i].menu_item, receipt[i].quantity, "0"]);
            }
            else {
                await db.execute(record_order_history_sql, [req.oidc.user.name, req.oidc.user.email, receipt[i].menu_item, receipt[i].quantity, receipt[i].requests, "0"]);
            }
        }

        res.render("order_success", { receipt: receipt, sum: sum[0].sum });

    } catch (err) {
        res.status(500).send(err.message);
    }
    // db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
    //     if (error)
    //         res.status(500).send(error);
    //     else if (results[0].isAdmin == 1) {
    //         res.redirect("/admin")
    //     }
    //     else {
    //         db.execute(read_receipt_sql, [req.oidc.user.email], (error, results) => {
    //             if (error)
    //                 res.status(500).send(error);
    //             else {
    //                 db.execute(read_receipt_sum_sql, [req.oidc.user.email], (error, results2) => {
    //                     if (error)
    //                         res.status(500).send(error);
    //                     else {
    //                         for (i=0; i<results.length; i++) {
    //                             if (results[i].requests == null) {
    //                                 db.execute(record_order_history_sql_null, [req.oidc.user.name, req.oidc.user.email, results[i].menu_item, results[i].quantity, "0"], (error, results3) => {
    //                                     if (error)
    //                                         res.status(500).send(error);
    //                                 })
    //                             }
    //                             else {
    //                                 db.execute(record_order_history_sql, [req.oidc.user.name, req.oidc.user.email, results[i].menu_item, results[i].quantity, results[i].requests, "0"], (error, results3) => {
    //                                     if (error)
    //                                         res.status(500).send(error);
    //                                 })
    //                             } 
    //                         }
    //                         res.render('order_success', {receipt : results, sum : results2[0].sum })        
    //                     }
    //                 })
    //             }
    //         })
    //     }
    // })
})

// rendering order history viewable by individual users

const read_history_user_sql =`
    SELECT
        username, 
        left(date, length(date) - char('G', reverse(date) + 'G')) as date,
        item, quantity, requests, isComplete
    FROM
        status
    WHERE
        email = ?
`
// time zone setting 

// const read_history_user_sql =`
//     SELECT
//         username, 
//         left(date at time zone 'America/New_York' from dual, length(date) - char('G', reverse(date) + 'G')) as date,
//         item, quantity, isComplete
//     FROM
//         status
//     WHERE
//         email = ?
// `

app.get("/history_user", requiresAuth(), async (req, res) => { 
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }
        let [user_history, _h] = await db.execute(read_history_user_sql, [req.oidc.user.email]);

        if (user_history.length == 0) {
            res.render("no_order_history_users");
        } else {
            res.render("order_history_users", { history: user_history });
        }

    } catch (err) {
        res.status(500).send(err.message);
    }
    // db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
    //     if (error)
    //         res.status(500).send(error);
    //     else if (results[0].isAdmin == 1) {
    //         res.redirect("/admin")
    //     }
    //     else {
    //         db.execute(read_history_user_sql, [req.oidc.user.email], (error, results2) => {
    //             if (error)
    //                 res.status(500).send(error);
    //             else {
    //                 if (results2.length == 0) {
    //                     res.render('no_order_history_users');
    //                 }
    //                 else {
    //                     res.render('order_history_users', {history : results2});
    //                 }
    //             }
    //         })
    //     }
    // })
})

// rendering order history for a specified user by admins

const read_history_admin_sql =`
    SELECT
        left(status.date, length(date) - char('G', reverse(date) + 'G')) as date,
        status.history_id, users.username, status.item, status.quantity, status.requests, status.isComplete, users.user_id
    FROM
        status
    INNER JOIN
        users ON status.email = users.email
    WHERE
        user_id = ?
`
//     SELECT
//         date, username, item, quantity, isComplete
//     FROM
//         status
//     WHERE
//         email = ?

app.get("/history_admin/:user", requiresAuth(), async (req, res) => { 
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }
        let [isAdmin, _i] = await db.execute(check_admin_permission_sql, [req.oidc.user.email]);
        if (isAdmin[0].isAdmin == 0) {
            res.redirect("/access_denied")
        }

        let [user_history, _h] = await db.execute(read_history_admin_sql, [req.params.user]);

        if (user_history.length == 0) {
            res.render("no_order_history_admin");
        } else {
            res.render("order_history_admin", { history: user_history });
        }

    } catch (err) {
        res.status(500).send(err.message);
    }
    // db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
    //     if (error)
    //         res.status(500).send(error);
    //     else if (results[0].isAdmin == 0) {
    //         res.redirect("/access_denied")
    //     }
    //     else {
    //         db.execute(read_history_admin_sql, [req.params.user], (error, results2) => {
    //             // console.log(results2.length);
    //             if (error)
    //                 res.status(500).send(error);
    //             else { 
    //                 if (results2.length == 0) {
    //                     res.render('no_order_history_admin', [user_id = req.params.user]);
    //                 }
    //                 else {
    //                 res.render('order_history_admin', {history : results2});
    //                 }
    //             }
    //         })
    //     }
    // })
})

// rendering the complete order history for all users

const read_history_admin_complete_sql =`
    SELECT
        history_id, 
        left(date, length(date) - char('G', reverse(date) + 'G')) as date, 
        username, email, item, quantity, requests, isComplete
    FROM
        status
`

app.get("/history_admin_complete", requiresAuth(), async (req, res) => { 
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }
        let [isAdmin, _i] = await db.execute(check_admin_permission_sql, [req.oidc.user.email]);
        if (isAdmin[0].isAdmin == 0) {
            res.redirect("/access_denied")
        }

        let [history_all, _a] = await db.execute(read_history_admin_complete_sql);

        if (history_all.length == 0) {
            res.render("no_order_history_complete");
        } else {
            res.render("order_history_complete", { history: history_all });
        }

    } catch (err) {
        res.status(500).send(err.message);
    }
    // db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
    //     if (error)
    //         res.status(500).send(error);
    //     else if (results[0].isAdmin == 0) {
    //         res.redirect("/access_denied")
    //     }
    //     else {
    //         db.execute(read_history_admin_complete_sql, (error, results2) => {
    //             if (error)
    //                 res.status(500).send(error);
    //             else {
    //                 if (results2.length == 0) {
    //                     res.render('no_order_history_complete');
    //                 }
    //                 else {
    //                     res.render('order_history_complete', {history : results2})
    //                 }
    //             }
    //         })
    //     }
    // })
})

// adjust the completion status of orders in order history

const not_completed_orders =`
    UPDATE
        status
    SET
        isComplete = 0
    WHERE
        history_id = ?
`

const completed_orders =`
    UPDATE
        status
    SET
        isComplete = 1
    WHERE
        history_id = ?
`

// order completion status update for complete order history
app.get("/history_admin_complete/:id/order_completed", requiresAuth(), async (req, res) => {
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }
        let [isAdmin, _i] = await db.execute(check_admin_permission_sql, [req.oidc.user.email]);
        if (isAdmin[0].isAdmin == 0) {
            res.redirect("/access_denied")
        }

        await db.execute(completed_orders, [req.params.id]);

        res.redirect("/history_admin_complete");

    } catch (err) {
        res.status(500).send(err.message);
    }
    // db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
    //     if (error)
    //         res.status(500).send(error);
    //     else if (results[0].isAdmin == 0) {
    //         res.redirect("/access_denied")
    //     }
    //     else {
    //         db.execute(completed_orders, [req.params.id], (error, results) => {
    //             if (error)
    //                 res.status(500).send(error);
    //             else {
    //                 res.redirect("/history_admin_complete")
    //             }
    //         })
    //     }
    // })
})

app.get("/history_admin_complete/:id/order_not_completed", requiresAuth(), async (req, res) => {
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }
        let [isAdmin, _i] = await db.execute(check_admin_permission_sql, [req.oidc.user.email]);
        if (isAdmin[0].isAdmin == 0) {
            res.redirect("/access_denied")
        }

        await db.execute(not_completed_orders, [req.params.id]);

        res.redirect("/history_admin_complete");

    } catch (err) {
        res.status(500).send(err.message);
    }
    // db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
    //     if (error)
    //         res.status(500).send(error);
    //     else if (results[0].isAdmin == 0) {
    //         res.redirect("/access_denied")
    //     }
    //     else {
    //         db.execute(not_completed_orders, [req.params.id], (error, results) => {
    //             if (error)
    //                 res.status(500).send(error);
    //             else {
    //                 res.redirect("/history_admin_complete")
    //             }
    //         })
    //     }
    // })
})

// order completion status update for individual user order history
app.get("/history_admin/:user_id/:history_id/order_completed", requiresAuth(), async (req, res) => {
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }
        let [isAdmin, _i] = await db.execute(check_admin_permission_sql, [req.oidc.user.email]);
        if (isAdmin[0].isAdmin == 0) {
            res.redirect("/access_denied")
        }

        await db.execute(completed_orders, [req.params.history_id]);

        res.redirect("/history_admin" + req.params.user_id);

    } catch (err) {
        res.status(500).send(err.message);
    }
    // db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
    //     if (error)
    //         res.status(500).send(error);
    //     else if (results[0].isAdmin == 0) {
    //         res.redirect("/access_denied")
    //     }
    //     else {
    //         db.execute(completed_orders, [req.params.history_id], (error, results2) => {
    //             if (error)
    //                 res.status(500).send(error);
    //             else {
    //                 res.redirect("/history_admin/" + req.params.user_id)
    //             }
    //         })
    //     }
    // })
})

app.get("/history_admin/:user_id/:history_id/order_not_completed", requiresAuth(), async (req, res) => {
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }
        let [isAdmin, _i] = await db.execute(check_admin_permission_sql, [req.oidc.user.email]);
        if (isAdmin[0].isAdmin == 0) {
            res.redirect("/access_denied")
        }

        await db.execute(not_completed_orders, [req.params.history_id]);

        res.redirect("/history_admin" + req.params.user_id);

    } catch (err) {
        res.status(500).send(err.message);
    }
    // db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
    //     if (error)
    //         res.status(500).send(error);
    //     else if (results[0].isAdmin == 0) {
    //         res.redirect("/access_denied")
    //     }
    //     else {
    //         db.execute(not_completed_orders, [req.params.history_id], (error, results2) => {
    //             if (error)
    //                 res.status(500).send(error);
    //             else {
    //                 res.redirect("/history_admin/" + req.params.user_id)
    //             }
    //         })
    //     }
    // })
})

// redirect to no order history found page if no matching results return

// const read_no_order_history_admin =`
//     SELECT
//         user_id
//     FROM
//         users
//     WHERE
//         user_id = ?
// `
// app.get("/no_order_history_found_admin/:user_id", requiresAuth(), (req, res) => {
//     db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
//         if (error)
//             res.status(500).send(error);
//         else if (results[0].isAdmin == 0) {
//             res.redirect("/access_denied")
//         }
//         else {
//             db.execute(read_no_order_history_admin, [req.params.user_id], (error, results2) => {
//                 if (error)
//                     res.status(500).send(error);
//                 else {
//                     res.render("no_order_history_found_admin", results)
//                 }
//             })
//         }
//     })
// })

function createTemp(currMenu) {
    let temp = [];
    let numIncomplete = [];
    console.log(currMenu.length);
    for (let i = 0; i < currMenu.length; i++) {
        db.execute(count_number_incompleted_orders, [currMenu[i].menu_item], (error, num) => {
            if (error)
                res.status(500).send(error);
            else {
                if (num[0].sum == null) {
                    numIncomplete[i] = 0;
                }
                else {
                    numIncomplete[i] = num[0].sum;
                    if (numIncomplete[i] >= currMenu[i].numAvail) {
                        temp[i] = currMenu[i].menu_item;
                    }
                }
            }
        })

    }
    const promiseB = new Promise(console.log(temp))
    Promise.all([promiseA, promiseB])
    return temp;
}

// // Error page when the selected orders for the week has been completed already
app.get( "/order_filled", requiresAuth(), async ( req, res ) => {
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }
        
        let [menu, _m] = await db.execute(read_num_menu_sql);

        let temp = [];
        let numIncomplete = [];

        for (let i=0; i<menu.length; i++) {
            let [incomplete_orders, _i] = await db.execute(count_number_incompleted_orders, [menu[i].menu_item]);
            if (incomplete_orders[0].sum == null) {
                numIncomplete[i] = 0;
            } else {
                numIncomplete[i] = incomplete_orders[0].sum;
                if (numIncomplete[i] >= menu[i].numAvail) {
                    temp[i] = menu[i].menu_item;
                }
            }
        }

        res.render("order_filled", { filled_order: temp });

    } catch (err) {
        res.status(500).send(err.message);
    }
    // db.execute(check_admin_permission_sql, [req.oidc.user.email], (error, results) => {
    //     if (error)
    //         res.status(500).send(error);
    //     else if (results[0].isAdmin == 1) {
    //         res.redirect("/admin")
    //     }
    //     else { 
    //         db.execute(read_num_menu_sql, (error, currMenu) => {
    //             if (error)
    //                 res.status(500).send(error);
    //             else {
    //                 let temp = [];
    //                 let numIncomplete = [];
    //                 // console.log(currMenu.length);
    //                 for (let i = 0; i < currMenu.length; i++) {
    //                     db.execute(count_number_incompleted_orders, [currMenu[i].menu_item], (error, num) => {
    //                         if (error)
    //                             res.status(500).send(error);
    //                         else {
    //                             if (num[0].sum == null) {
    //                                 numIncomplete[i] = 0;
    //                             }
    //                             else {
    //                                 numIncomplete[i] = num[0].sum;
    //                                 if (numIncomplete[i] >= currMenu[i].numAvail) {
    //                                     temp[i] = currMenu[i].menu_item;
    //                                 }
    //                             }
    //                         }
    //                     })
    //                 }       
    //                 setTimeout(() => {res.render('order_filled', { filled_order : temp });}, 500);
    //             }   
    //         })
    //     }
    // })
} );

// start the server
app.listen( port, () => {
    console.log(`App server listening on ${ port }. (Go to http://localhost:${ port })` );
} );