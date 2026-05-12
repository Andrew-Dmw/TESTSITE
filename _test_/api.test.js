const request = require('supertest');
const app = require('../index');

// Вспомогательная функция: логин и получение агента с сессией
async function loginAndGetAgent(email, password) {
    const agent = request.agent(app);
    const res = await agent
        .post('/login')
        .send({ email, password })
        .expect(302); // редирект на /main после успешного входа
    return agent;
}

describe('Формально-юридическая модель - API тесты', () => {
    // Демо-пользователь (должен существовать в тестовой БД)
    const testUser = {
        email: 'demo@example.com',
        password: 'demo123!'
    };

    // 1. Тест отзыва согласия (требует авторизации)
    describe('POST /revoke-consent', () => {
        it('должен вернуть 401, если не авторизован', async () => {
            await request(app)
                .post('/revoke-consent')
                .send({})
                .expect(401);
        });

        it('должен успешно отозвать согласие для авторизованного пользователя', async () => {
            const agent = await loginAndGetAgent(testUser.email, testUser.password);
            const res = await agent
                .post('/revoke-consent')
                .send({}) // email не передаётся, берётся из сессии
                .expect(302); // редирект на /ER
            expect(res.headers.location).toBe('/ER');
        });
    });

    // 2. Тест удаления данных (требует авторизации)
    describe('POST /delete-data', () => {
        it('должен вернуть 401 без авторизации', async () => {
            await request(app).post('/delete-data').send({}).expect(401);
        });

        it('должен удалить данные авторизованного пользователя', async () => {
            const agent = await loginAndGetAgent(testUser.email, testUser.password);
            const res = await agent
                .post('/delete-data')
                .send({}) // email из сессии
                .expect(302);
            expect(res.headers.location).toBe('/ER');
        });
    });

    // 3. Тест экспорта данных
    describe('GET /export-data', () => {
        it('должен вернуть 401 без авторизации', async () => {
            await request(app).get('/export-data').expect(401);
        });

        it('должен вернуть JSON для авторизованного пользователя', async () => {
            const agent = await loginAndGetAgent(testUser.email, testUser.password);
            const res = await agent
                .get('/export-data')
                .expect(200)
                .expect('Content-Type', /json/);
            expect(res.body.user.email).toBe(testUser.email);
            expect(res.body.legal_notice).toContain('ст. 14 ФЗ-152');
        });
    });
});

describe('POST /submit-feedback', () => {
    it('должен вернуть 400, если feedback отсутствует', async () => {
        const res = await request(app).post('/submit-feedback').send({}).expect(400);
        expect(res.body.error).toBe('No feedback provided');
    });
    it('должен сохранить фидбек', async () => {
        const res = await request(app).post('/submit-feedback').send({ feedback: 'Тест' }).expect(200);
        expect(res.body.message).toBe('Feedback saved');
        expect(res.body.id).toBeDefined();
    });
});