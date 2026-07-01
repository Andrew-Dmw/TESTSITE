const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const config = require('../config');

const TEST_DB = {
    host: process.env.DB_HOST || config.db.host,
    user: process.env.DB_USER || config.db.user,
    password: process.env.DB_PASSWORD || config.db.password,
    database: process.env.DB_DATABASE || config.db.database,
};

const TEST_USER = {
    email: 'demo@example.com',
    password: 'demo123!',
};

async function ensureDemoUser() {
    const pepper = process.env.PASSWORD_PEPPER || 'test_pepper';
    const hashedPassword = await bcrypt.hash(TEST_USER.password + pepper, 10);
    const conn = await mysql.createConnection(TEST_DB);
    await conn.execute(`
        INSERT INTO users (email, name, password_hash, role, privacy_consent_given, privacy_consent_date)
        VALUES (?, 'Demo User', ?, 'admin', TRUE, NOW())
        ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role)
    `, [TEST_USER.email, hashedPassword]);
    await conn.end();
}

module.exports = { TEST_DB, TEST_USER, ensureDemoUser };