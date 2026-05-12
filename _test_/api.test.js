const request = require('supertest');
const app = require('../index');

// Вспомогательная функция: логин и получение агента с сессией
async function loginAndGetAgent(email, password) {
    const agent = request.agent(app);
    await agent
        .post('/login')
        .send({ email, password })
        .expect(302);
    return agent;
}

describe('Формально-юридическая модель - API тесты', () => {
    const testUser = {
        email: 'demo@example.com',
        password: 'demo123!'
    };

    let demoAgent;
    beforeAll(async () => {
        demoAgent = await loginAndGetAgent(testUser.email, testUser.password);
    });

    // Тест отзыва согласия
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

    // Тест удаления данных
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

    // Тест экспорта данных
    describe('GET /export-data', () => {
        it('должен вернуть 401 без авторизации', async () => {
            await request(app).get('/export-data').expect(401);
        });
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

describe('POST /submit-feedback', () => {
    let agent;
    beforeAll(async () => {
        agent = await loginAndGetAgent('demo@example.com', 'demo123!');
    });

    it('должен вернуть 400, если feedback отсутствует', async () => {
        const res = await agent
            .post('/submit-feedback')
            .send({})
            .expect(400);
        expect(res.body.error).toBe('No feedback provided');
    });
    it('должен сохранить фидбек', async () => {
        const res = await agent
            .post('/submit-feedback')
            .send({ feedback: 'Тест' })
            .expect(200);
        expect(res.body.message).toBe('Feedback saved');
        expect(res.body.id).toBeDefined();
    });
});