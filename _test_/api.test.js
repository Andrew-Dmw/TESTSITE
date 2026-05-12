const request = require('supertest');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const app = require('../index');
const config = require('../config');

const testUser = {
    email: 'demo@example.com',
    password: 'demo123!'
};

let dbConfig;

beforeAll(async () => {
    dbConfig = {
        host: config.db.host,
        user: config.db.user,
        password: config.db.password,
        database: config.db.database
    };
    const connection = await mysql.createConnection(dbConfig);
    const pepper = process.env.PASSWORD_PEPPER || 'test_pepper';
    const hashedPassword = await bcrypt.hash(testUser.password + pepper, 10);
    await connection.execute(`
        INSERT INTO users (email, name, password_hash, role, privacy_consent_given, privacy_consent_date)
        VALUES (?, 'Demo User', ?, 'admin', TRUE, NOW())
        ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role)
    `, [testUser.email, hashedPassword]);
    await connection.execute(`
        INSERT IGNORE INTO consents (user_id, purpose, version, is_active, given_at, ip_address, user_agent)
        SELECT id, 'регистрация', 'v1.0', TRUE, NOW(), '127.0.0.1', 'test'
        FROM users WHERE email = ?
    `, [testUser.email]);
    await connection.execute(`
        INSERT IGNORE INTO user_data (user_id, field_name, field_value)
        SELECT id, 'phone', '+7 999 123-45-67'
        FROM users WHERE email = ?
    `, [testUser.email]);
    await connection.end();
});

async function loginAndGetAgent(email, password) {
    const agent = request.agent(app);
    await agent
        .post('/login')
        .send({ email, password })
        .expect(302);
    return agent;
}

let demoAgent;

beforeAll(async () => {
    demoAgent = await loginAndGetAgent(testUser.email, testUser.password);
});

describe('Формально-юридическая модель - API тесты', () => {
    describe('GET /export-data', () => {
        it('должен вернуть JSON для авторизованного пользователя', async () => {
            const res = await demoAgent
                .get('/export-data')
                .expect(200)
                .expect('Content-Type', /json/);
            expect(res.body.user.email).toBe(testUser.email);
            expect(res.body.legal_notice).toContain('ст. 14 ФЗ-152');
        });
    });
});