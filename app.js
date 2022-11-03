//set up the server
const express = require("express");
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

//auth 0 stuff!
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
app.get("/testLogin", (req, res) => {
    res.send(req.oidc.isAuthenticated() ? 'Logged in' : 'Logged out');
  });

const { requiresAuth } = require('express-openid-connect');
const { format } = require("mysql2");

app.get("/profile", requiresAuth(), (req, res) => {
    res.send(JSON.stringify(req.oidc.user));
});

// define a route for the default home page
app.get("/", ( req, res ) => {
    res.render("index");
} );


// use middleware and combining requiresAuth() on top to prevent excessive callback loops

// app.use(requiresAuth());
// middleware -> if authenticated, check if admin or not. Take result, attach later

// prevent and redirect users from attempting to order an item not available on the menu
app.get("/menu/no_match", requiresAuth(), async ( req, res ) => {
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
} );

// prevent and redirect users from attempting to view or edit an order that does not exist
app.get("/menu/no_id_found", requiresAuth(), async ( req, res ) => {
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
} );

// prevent and redirect admins from attempting to view or edit a menu item that does not exist
app.get("/edit/no_id_found", requiresAuth(), async ( req, res ) => {
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
} );

// prevent and redirect users from attempting to access pages that require admin permissions
app.get("/access_denied", requiresAuth(), async ( req, res ) => {
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
// reads the settings from db
const read_settings_sql = `
    SELECT
        orderBy, announcement, curr_week
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
        let [notice, _by] = await db.execute(read_settings_sql);
        console.log(numIncomplete);
        res.render("menu", { orders: read_orders, menu: menu, username: req.oidc.user.name, sum: read_sum[0].sum, notice: notice[0], incompleteOrders: numIncomplete })
    } catch (err) {
        res.status(500).send(err.message);
    }
})

// render the users database on admin page
const read_admin_edit_sql = `
    SELECT
        user_id, username, email, phone, isAdmin
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
})

// render the menu edit page for admins
const read_edit_menu_sql = `
    SELECT
        menu_id, menu_item, price, calories, description, numAvail
    FROM
        menu
`

app.get("/edit", requiresAuth(), async (req, res) => {
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
        let [settings, _s] = await db.execute(read_settings_sql);

        res.render("menu_edit", { menu: menu, settings: settings[0] })

    } catch (err) {
        res.status(500).send(err.message);
    }
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

app.get("/admin", requiresAuth(), async (req, res) => {
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
            // res.redirect("/menu")
            res.status(301).redirect(`www.minmeals.com/menu`);
        }

        // let [admin, _a] = await db.execute(read_admin_sql, [req.oidc.user.email]);

        res.render("admin_main", { username: req.oidc.user.name })
        
    } catch (err) {
        res.status(500).send(err.message);
    }
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
        
        await db.execute(delete_user_sql, [req.params.id]);

        res.redirect("/admin_edit");

    } catch (err) {
        res.status(500).send(err.message);
    }
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

        let [results, _r] = await db.execute(check_item_match_sql, [req.body.item]);
        if (results.length == 0) {
            res.redirect("/menu/no_match");
        } else {
            await db.execute(create_item_sql, [req.body.item, req.body.quantity, req.body.requests, req.oidc.user.email]);
            res.redirect("/menu");
        }

    } catch (err) {
        res.status(500).send(err.message);
    }
})

// allow admins to create new menu items
const create_menu_sql = `
    INSERT INTO menu
        (menu_item, price, calories, description, numAvail)
    VALUES
        (?, ?, ?, ?, ?)
`
// update the date that current set of orders are due by

const update_settings_sql =`
    UPDATE
        settings
    SET
        orderBy = ?,
        announcement = ?,
        curr_week = ?
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

        // console.log(req.body.orderBy);
        // console.log(req.body.menu);

        if (req.body.orderBy != null) {
            console.log("1");
            await db.execute(update_settings_sql, [req.body.orderBy, req.body.announcement, req.body.curr_week]);
        } 
        if (req.body.menu != null) {
            console.log("2");
            await db.execute(create_menu_sql, [req.body.menu, req.body.price, req.body.calories, req.body.description, req.body.numAvail]);
        }

        res.redirect("/edit");

    } catch (err) {
        res.status(500).send(err.message);
    }
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

// define a route for the item detail page
app.get("/menu/item/:id", requiresAuth(), async (req, res ) => {
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

app.get("/edit/item/:id", requiresAuth(), async (req, res ) => {
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

        res.redirect("/menu/item/" + req.params.id)
        
    } catch (err) {
        res.status(500).send(err.message);
    }
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

        res.redirect("/edit/item/" + req.params.id);

    } catch (err) {
        res.status(500).send(err.message);
    }
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
        status (username, email, phone, item, quantity, requests, isComplete, sort)
    VALUES
        (?, ?, ?, ?, ?, ?, ?, ?)
`

// adjusted sql for when the user gives no special requests
const record_order_history_sql_null =`
    INSERT INTO 
        status (username, email, phone, item, quantity, isComplete, sort)
    VALUES
        (?, ?, ?, ?, ?, ?, ?)
`

// check if the item ordered is available
const check_num_ordered_sql =`
    SELECT
        SUM(quantity) sum
    FROM
        orders
    WHERE
        item = ?
        AND
        email = ?
`

const check_availability_sql =`
    SELECT
        item
    FROM
        orders
    WHERE
        item = ?
        AND
        email = ?
`

// read if the user has a phone number associated with account
const read_phone_sql =`
    SELECT
        phone
    FROM
        users
    WHERE
        email = ?
`

// add phone number to user db if users submits contacts information
const update_phone_sql =`
    UPDATE
        users
    SET
        phone = ?
    WHERE
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
        let [phone, _p] = await db.execute(read_phone_sql, [req.oidc.user.email]);

        let [menu, _m] = await db.execute(read_num_menu_sql, [req.oidc.user.email]);
        let numIncomplete = [];
        let temp1 = [];
        let temp2 = [];
        let temp3 = [];

        for (let i=0; i<receipt.length; i++) {
            let [ordered, _o] = await db.execute(check_num_ordered_sql, [receipt[i].menu_item, req.oidc.user.email]);
            let [incomplete_orders, _incomplete] = await db.execute(count_number_incompleted_orders, [receipt[i].menu_item]);
            if (incomplete_orders[0].sum == null) {
                numIncomplete[i] = 0;
            }
            else {
                numIncomplete[i] = incomplete_orders[0].sum
            } if (ordered[0].sum > receipt[i].numAvail - numIncomplete[i]) {
                temp1[i] = receipt[i].menu_item; // saves the current name of order for each overflowed
                temp2[i] = receipt[i].numAvail - numIncomplete[i]; // saves current number of orders available for each overflowed
            }
        }

        for (i=0; i<menu.length; i++) {
            let [num, _n] = await db.execute(check_availability_sql, [menu[i].menu_item, req.oidc.user.email]);
            let [incomplete_orders, _i] = await db.execute(count_number_incompleted_orders, [menu[i].menu_item]);
            if (incomplete_orders[0].sum == null) {
                numIncomplete[i] = 0;
            } else {
                numIncomplete[i] = incomplete_orders[0].sum;
            } if (numIncomplete[i] >= menu[i].numAvail && num.length > 0) {
                temp3[i] = menu[i].menu_item;
            }
        }

        if (temp1.length > 0 && temp3.length == 0) {
            res.redirect("/insufficient");
        }
        else if (temp3.length > 0) {
            res.redirect("/order_filled");
        }
        else {
            res.render("checkout", { receipt: receipt, sum: sum[0].sum, email: req.oidc.user.email, phone: phone[0].phone });
        }
    
    } catch (err) {
        res.status(500).send(err.message);
    }
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

        res.render("order_success", { receipt: receipt, sum: sum[0].sum });

    } catch (err) {
        res.status(500).send(err.message);
    }
})

// read the settings for current week count
const read_curr_week_sql =`
    SELECT
        curr_week
    FROM
        settings
`

// action after submitting form on checkout page
app.post("/checkout", requiresAuth(), async (req, res) => {
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }

        let [receipt, _r] = await db.execute(read_receipt_sql, [req.oidc.user.email]);
        let [curr_week, _c] = await db.execute(read_curr_week_sql);
        // console.log(curr_week[0].curr_week);
        
        for (let i=0; i<receipt.length; i++) {
            if (receipt[i].requests == null) {
                await db.execute(record_order_history_sql_null, [req.oidc.user.name, req.oidc.user.email, req.body.phone, receipt[i].menu_item, receipt[i].quantity, "0", curr_week[0].curr_week]);
            }
            else {
                await db.execute(record_order_history_sql, [req.oidc.user.name, req.oidc.user.email, req.body.phone, receipt[i].menu_item, receipt[i].quantity, receipt[i].requests, "0", curr_week[0].curr_week]);
            }
        }

        await db.execute(update_phone_sql, [req.body.phone, req.oidc.user.email]);

        res.redirect("/success");

    } catch (err) {
        res.status(500).send(err.message);
    }
})

// rendering order history viewable by individual users

const read_history_user_sql =`
    SELECT
        username, 
        left(date, length(date) - char('G', reverse(date) + 'G')) as date,
        item, quantity, requests, isComplete, sort
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
})

// rendering order history for a specified user by admins

const read_history_admin_sql =`
    SELECT
        left(status.date, length(date) - char('G', reverse(date) + 'G')) as date,
        status.history_id, users.username, status.item, status.quantity, status.requests, status.isComplete, status.sort, users.user_id
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
})

// reading the currently selected sorting value

const sort_setting_history_sql =`
    SELECT
        week
    FROM
        settings
`

// rendering the complete order history for all users
const read_history_admin_complete_sql =`
    SELECT
        history_id, 
        left(date, length(date) - char('G', reverse(date) + 'G')) as date, 
        username, email, phone, item, quantity, requests, isComplete, sort
    FROM
        status
`

// rendering only the partial order history that matches sort
const read_history_admin_sorted_sql =`
    SELECT
        history_id, 
        left(date, length(date) - char('G', reverse(date) + 'G')) as date, 
        username, email, phone, item, quantity, requests, isComplete, sort
    FROM
        status
    INNER JOIN
        settings ON settings.week = status.sort
`

// read all of the available 'sort' values present in 'status'
const read_sort_sql =`
    SELECT DISTINCT
        sort
    FROM
        status
    ORDER BY
        sort
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

        let [sort_val, _s] = await db.execute(sort_setting_history_sql);
        let [sort_avail, _sa] = await db.execute(read_sort_sql);

        let [history_all, _a] = await db.execute(read_history_admin_complete_sql);
        let [history_sorted, _h] = await db.execute(read_history_admin_sorted_sql);

        if (sort_val[0].week == 0) {
            if (history_all.length == 0) {
                res.render("no_order_history_complete");
            } else {
                res.render("order_history_complete", { history: history_all, sort: sort_avail, sort_val: sort_val[0].week });
            }
        } else {
            if (history_all.length == 0) {
                res.render("no_order_history_complete"); 
            } else {
                res.render("order_history_complete", { history: history_sorted, sort: sort_avail, sort_val: sort_val[0].week }); 
            }
        } 

    } catch (err) {
        res.status(500).send(err.message);
    }
})

// update settings based on

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

        res.redirect("/history_admin/" + req.params.user_id);

    } catch (err) {
        res.status(500).send(err.message);
    }
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

        res.redirect("/history_admin/" + req.params.user_id);

    } catch (err) {
        res.status(500).send(err.message);
    }
})

// Updating the currently selected sort value
const select_sort_sql =`
    UPDATE
        settings
    SET
        week = ?
`

// Update the sort value selected and re-render the complete admin history page
app.get("/history_admin_complete/:id", requiresAuth(), async (req, res) => {
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

        await db.execute(select_sort_sql, [req.params.id]);

        res.redirect("/history_admin_complete");

    } catch (err) {
        res.status(500).send(err.message);
    }
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

// Error page when the selected orders for the week has been completed already
app.get("/order_filled", requiresAuth(), async ( req, res ) => {
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
            let [num, _n] = await db.execute(check_availability_sql, [menu[i].menu_item, req.oidc.user.email]);
            if (incomplete_orders[0].sum == null) {
                numIncomplete[i] = 0;
            } else {
                numIncomplete[i] = incomplete_orders[0].sum;
            } if (numIncomplete[i] >= menu[i].numAvail && num.length > 0) {
                temp[i] = menu[i].menu_item;
            }
        }

        res.render("order_filled", { filled_order: temp });

    } catch (err) {
        res.status(500).send(err.message);
    }
} );

// Error page when the user submits too many orders for the week
app.get("/insufficient", requiresAuth(), async ( req, res ) => {
    try {
        let [users, _u] = await db.execute(check_user_match_sql, [req.oidc.user.email]);
        if (users.length == 0) {
            await db.execute(add_user_sql, [req.oidc.user.name, req.oidc.user.email]);
            console.log(`Added user to db with email ${req.oidc.user.email}`);
        } else {
            console.log("User exists in db")
        }
        
        let [receipt, _r] = await db.execute(read_receipt_sql, [req.oidc.user.email]);

        let numIncomplete = [];
        let temp1 = [];
        let temp2 = [];

        for (let i=0; i<receipt.length; i++) {
            let [ordered, _o] = await db.execute(check_num_ordered_sql, [receipt[i].menu_item, req.oidc.user.email]);
            let [incomplete_orders, _incomplete] = await db.execute(count_number_incompleted_orders, [receipt[i].menu_item]);
            if (incomplete_orders[0].sum == null) {
                numIncomplete[i] = 0;
            }
            else {
                numIncomplete[i] = incomplete_orders[0].sum
            } if (ordered[0].sum > receipt[i].numAvail - numIncomplete[i]) {
                temp1[i] = receipt[i].menu_item; 
                temp2[i] = receipt[i].numAvail - numIncomplete[i]; 
            }
        }

        res.render("insufficient", { filled_order: temp1, num_left: temp2 });

    } catch (err) {
        res.status(500).send(err.message);
    }
} );

// start the server
app.listen( port, () => {
    console.log(`App server listening on ${ port }. (Go to http://localhost:${ port })` );
} );