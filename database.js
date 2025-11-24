require("dotenv").config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

const initializeDB = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Users Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL
            );
        `);

        // 2. Orders Temp Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS orders_temp (
                id SERIAL PRIMARY KEY,
                date TEXT,
                user_name TEXT,
                phone TEXT,
                title TEXT,
                link TEXT,
                page_name TEXT,
                usd_price NUMERIC,
                qty INTEGER,
                customer_price NUMERIC,
                deposit NUMERIC,
                remaining NUMERIC,
                profit NUMERIC
            );
        `);

        // 3. Archive Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS archive (
                batch_id SERIAL PRIMARY KEY,
                order_code TEXT,
                created_at TIMESTAMP,
                total_usd NUMERIC,
                total_qty INTEGER,
                total_profit NUMERIC,
                json_data TEXT
            );
        `);

        // 4. Session Table (for connect-pg-simple)
        await client.query(`
            CREATE TABLE IF NOT EXISTS session (
                sid varchar NOT NULL COLLATE "default",
                sess json NOT NULL,
                expire timestamp(6) NOT NULL
            )
            WITH (OIDS=FALSE);
        `);

        // Add constraint if not exists (Postgres doesn't support IF NOT EXISTS for constraints easily in one line, 
        // but we can try adding it and ignoring error or checking first. 
        // For simplicity in this script, we'll assume if table exists, constraint might too, 
        // or we just run a separate block to add primary key if missing.
        // Actually, connect-pg-simple documentation recommends this table structure.
        // Let's just try to add the primary key constraint, catching error if it exists.
        try {
            await client.query('SAVEPOINT session_pkey_savepoint');
            await client.query('ALTER TABLE session ADD CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE');
            await client.query('RELEASE SAVEPOINT session_pkey_savepoint');
        } catch (e) {
            await client.query('ROLLBACK TO SAVEPOINT session_pkey_savepoint');
            // Ignore if already exists
        }

        await client.query('CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON session (expire)');

        // Seed Admin User
        const adminUsername = 'admin';
        const adminPassword = 'admin123';
        const saltRounds = 10;

        const res = await client.query('SELECT id FROM users WHERE username = $1', [adminUsername]);
        if (res.rows.length === 0) {
            const hash = await bcrypt.hash(adminPassword, saltRounds);
            await client.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', [adminUsername, hash]);
            console.log('Admin user created.');
        }

        await client.query('COMMIT');
        console.log('Database initialized successfully.');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Error initializing database:', e);
    } finally {
        client.release();
    }
};

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
    initializeDB
};
