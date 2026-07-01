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

    // Создаём тестового пользователя с ролью admin (как и было)
    await connection.execute(`
        INSERT INTO users (email, name, password_hash, role, privacy_consent_given, privacy_consent_date)
        VALUES (?, 'Demo User', ?, 'admin', TRUE, NOW())
        ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role)
    `, [testUser.email, hashedPassword]);

    // Добавляем согласие
    await connection.execute(`
        INSERT IGNORE INTO consents (user_id, purpose, version, is_active, given_at, ip_address, user_agent)
        SELECT id, 'регистрация', 'v1.0', TRUE, NOW(), '127.0.0.1', 'test'
        FROM users WHERE email = ?
    `, [testUser.email]);

    // Добавляем тестовые пользовательские данные (для проверки экспорта)
    await connection.execute(`
        INSERT IGNORE INTO user_data (user_id, field_name, field_value)
        SELECT id, 'phone', '+7 999 123-45-67'
        FROM users WHERE email = ?
    `, [testUser.email]);

    // Очищаем журнал событий экспорта для этого IP, чтобы избежать блокировки в тесте
    await connection.execute(`
        DELETE FROM event_logs WHERE action = 'data_exported' AND ip_address = '::ffff:127.0.0.1'
    `);

    await connection.end();

    // Авторизуем агента один раз для всех тестов
    demoAgent = request.agent(app);
    await demoAgent
        .post('/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(302);
});

// Группируем тесты в правильном порядке: сначала экспорт (пока данные есть),
// потом отзыв согласия и удаление данных
describe('API формально-юридической модели', () => {
    // 1. Экспорт данных
    describe('GET /export-data', () => {
        it('должен вернуть 401 без авторизации', async () => {
            await request(app).get('/export-data').expect(401);
        });

        it('должен вернуть JSON с данными пользователя (один вызов)', async () => {
            const res = await demoAgent
                .get('/export-data')
                .expect(200)
                .expect('content-type', /json/);

            // Проверяем структуру ответа
            expect(res.body).toHaveProperty('user');
            expect(res.body.user.email).toBe(testUser.email);
            expect(res.body.custom_fields).toBeDefined();
            expect(res.body.consents_history).toBeDefined();
            expect(res.body.export_date).toBeDefined();
            expect(res.body.legal_notice).toContain('ФЗ-152');
        });
    });

    // 2. Отзыв согласия
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

    // 3. Удаление данных
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