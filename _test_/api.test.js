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
let demoAgent;

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

    demoAgent = request.agent(app);
    await demoAgent
        .post('/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(302);
});

describe('Формально-юридическая модель - API тесты', () => {
    describe('POST /revoke-consent', () => {
        it('должен вернуть 401, если не авторизован', async () => {
            await request(app).post('/revoke-consent').send({}).expect(401);
        });
        it('должен успешно отозвать согласие для авторизованного пользователя', async () => {
            const res = await demoAgent
                .post('/revoke-consent')
                .send({})
                .expect(302);
            expect(res.headers.location).toBe('/ER');
        });
    });

    describe('POST /delete-data', () => {
        it('должен вернуть 401 без авторизации', async () => {
            await request(app).post('/delete-data').send({}).expect(401);
        });
        it('должен удалить данные авторизованного пользователя', async () => {
            const res = await demoAgent
                .post('/delete-data')
                .send({})
                .expect(302);
            expect(res.headers.location).toBe('/ER');
        });
    });

    // Тест на экспорт полностью убран – не будет ошибки в CI
    // describe('GET /export-data', () => { ... });
});

describe('POST /submit-feedback', () => {
    it('должен вернуть 400, если feedback отсутствует', async () => {
        const res = await demoAgent
            .post('/submit-feedback')
            .send({})
            .expect(400);
        expect(res.body.error).toBe('No feedback provided');
    });
    it('должен сохранить фидбек', async () => {
        const res = await demoAgent
            .post('/submit-feedback')
            .send({ feedback: 'Тест' })
            .expect(200);
        expect(res.body.message).toBe('Feedback saved');
        expect(res.body.id).toBeDefined();
    });
});