const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Database on Start
db.initializeDB();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session Setup
app.use(session({
    store: new pgSession({
        pool: db.pool,                // Connection pool
        tableName: 'session'   // Use defined table name
    }),
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // true if https
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
}));

// Authentication Middleware
function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized' });
}

// Routes

// 1. Authentication
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await db.query("SELECT * FROM users WHERE username = $1", [username]);
        const user = result.rows[0];

        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const match = await bcrypt.compare(password, user.password_hash);
        if (match) {
            req.session.userId = user.id;
            req.session.username = user.username;
            res.json({ message: 'Login successful' });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ error: 'Logout failed' });
        res.json({ message: 'Logged out' });
    });
});

app.get('/api/me', (req, res) => {
    if (req.session.userId) {
        res.json({ loggedIn: true, username: req.session.username });
    } else {
        res.json({ loggedIn: false });
    }
});

// 2. Orders (Page 1 -> Page 2)
app.post('/api/orders', async (req, res) => {
    const orders = req.body;
    if (!Array.isArray(orders)) {
        return res.status(400).json({ error: 'Invalid data format' });
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const queryText = `
            INSERT INTO orders_temp (
                date, user_name, phone, title, link, page_name, 
                usd_price, qty, customer_price, deposit, remaining, profit
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `;

        for (const order of orders) {
            await client.query(queryText, [
                order.date, order.user, order.phone, order.title, order.link, order.pageName,
                order.usdPrice, order.qty, order.customerPrice, order.deposit, order.remaining, order.profit
            ]);
        }

        await client.query('COMMIT');
        res.json({ message: 'Orders added successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Transaction failed' });
    } finally {
        client.release();
    }
});

app.get('/api/orders', isAuthenticated, async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM orders_temp ORDER BY id ASC");
        // Map back to camelCase for frontend if needed, or just let frontend handle snake_case.
        // Let's map it to match existing frontend expectations to minimize frontend churn.
        const rows = result.rows.map(row => ({
            id: row.id,
            date: row.date,
            user: row.user_name,
            phone: row.phone,
            title: row.title,
            link: row.link,
            pageName: row.page_name,
            usdPrice: parseFloat(row.usd_price),
            qty: parseInt(row.qty),
            customerPrice: parseFloat(row.customer_price),
            deposit: parseFloat(row.deposit),
            remaining: parseFloat(row.remaining),
            profit: parseFloat(row.profit)
        }));
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/orders/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const data = req.body;

    // Construct dynamic update query
    // We only update fields that are present in body
    // But for simplicity, we can assume full object or specific fields.
    // The frontend sends specific fields usually? 
    // Actually the requirement says "Edit orders (and updates must be saved to DB)".
    // Let's assume the frontend sends the fields that changed or all fields.
    // For safety, let's map the incoming camelCase to snake_case and update.

    const fields = [];
    const values = [];
    let idx = 1;

    const mapping = {
        date: 'date',
        user: 'user_name',
        phone: 'phone',
        title: 'title',
        link: 'link',
        pageName: 'page_name',
        usdPrice: 'usd_price',
        qty: 'qty',
        customerPrice: 'customer_price',
        deposit: 'deposit',
        remaining: 'remaining',
        profit: 'profit'
    };

    for (const [key, val] of Object.entries(data)) {
        if (mapping[key] !== undefined) {
            fields.push(`${mapping[key]} = $${idx}`);
            values.push(val);
            idx++;
        }
    }

    if (fields.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    values.push(id);
    const sql = `UPDATE orders_temp SET ${fields.join(', ')} WHERE id = $${idx}`;

    try {
        await db.query(sql, values);
        res.json({ message: 'Order updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/orders/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query("DELETE FROM orders_temp WHERE id = $1", [id]);
        res.json({ message: 'Order deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/orders', isAuthenticated, async (req, res) => {
    try {
        await db.query("DELETE FROM orders_temp");
        res.json({ message: 'All temp orders cleared' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Archive (Page 2 -> Page 3)
app.post('/api/finalize', isAuthenticated, async (req, res) => {
    const { orderCode, totals, orders } = req.body;

    if (!orderCode || !orders || orders.length === 0) {
        return res.status(400).json({ error: 'Invalid data' });
    }

    const createdAt = new Date().toISOString();
    const jsonData = JSON.stringify(orders);

    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Add to archive
        await client.query(`
            INSERT INTO archive (order_code, created_at, total_usd, total_qty, total_profit, json_data) 
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [orderCode, createdAt, totals.totalUsd, totals.totalQty, totals.totalProfit, jsonData]);

        // 2. Clear temp orders
        await client.query("DELETE FROM orders_temp");

        await client.query('COMMIT');
        res.json({ message: 'Order finalized and archived' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Failed to archive' });
    } finally {
        client.release();
    }
});

app.get('/api/archive', isAuthenticated, async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM archive ORDER BY batch_id DESC");
        const rows = result.rows.map(row => ({
            batchId: row.batch_id,
            orderCode: row.order_code,
            createdAt: row.created_at,
            totalUsd: parseFloat(row.total_usd),
            totalQty: parseInt(row.total_qty),
            totalProfit: parseFloat(row.total_profit),
            orders: JSON.parse(row.json_data)
        }));
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/archive/:batchId', isAuthenticated, async (req, res) => {
    const { batchId } = req.params;
    try {
        await db.query("DELETE FROM archive WHERE batch_id = $1", [batchId]);
        res.json({ message: 'Batch deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Page Routes (Protected)
app.get('/page2', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'page2.html'));
});

app.get('/page3', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'page3.html'));
});

app.get('/login', (req, res) => {
    // If already logged in, redirect to page2
    if (req.session.userId) {
        return res.redirect('/page2');
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html')); // We need to create login.html or serve it
});

// Serve index.html for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

