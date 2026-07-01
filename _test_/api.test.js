const request = require('supertest');
const app = require('../index');
const { ensureDemoUser, TEST_USER } = require('./helpers');

beforeAll(async () => {
    await ensureDemoUser();
});

describe('API формально-юридической модели', () => {
    let demoAgent;

    // Создаём агента заново для каждой группы, чтобы не превышать лимит запросов
    beforeAll(async () => {
        demoAgent = request.agent(app);
        await demoAgent
            .post('/login')
            .send({ email: TEST_USER.email, password: TEST_USER.password })
            .expect(302);
    });

    describe('POST /revoke-consent', () => {
        it('должен вернуть 401, если не авторизован', async () => {
            await request(app).post('/revoke-consent').send({}).expect(401);
        });
        it('должен успешно отозвать согласие для авторизованного пользователя', async () => {
            const res = await demoAgent.post('/revoke-consent').send({}).expect(302);
            expect(res.headers.location).toBe('/ER');
        });
    });

    describe('POST /delete-data', () => {
        it('должен вернуть 401 без авторизации', async () => {
            await request(app).post('/delete-data').send({}).expect(401);
        });
        it('должен удалить данные авторизованного пользователя', async () => {
            const res = await demoAgent.post('/delete-data').send({}).expect(302);
            expect(res.headers.location).toBe('/ER');
        });
    });

    describe('GET /export-data', () => {
        it('должен вернуть JSON с данными пользователя', async () => {
            const res = await demoAgent
                .get('/export-data')
                .expect(200)
                .expect('content-type', /json/);
            expect(res.body).toHaveProperty('user');
            expect(res.body.user.email).toBe(TEST_USER.email);
            expect(res.body.legal_notice).toContain('ФЗ-152');
        });
    });
});

describe('POST /submit-feedback', () => {
    let demoAgent;
    beforeAll(async () => {
        demoAgent = request.agent(app);
        await demoAgent.post('/login').send({ email: TEST_USER.email, password: TEST_USER.password }).expect(302);
    });

    it('должен вернуть 400, если feedback отсутствует', async () => {
        const res = await demoAgent.post('/submit-feedback').send({}).expect(400);
        expect(res.body.error).toBe('No feedback provided');
    });
    it('должен сохранить фидбек', async () => {
        const res = await demoAgent.post('/submit-feedback').send({ feedback: 'Тест' }).expect(200);
        expect(res.body.message).toBe('Feedback saved');
        expect(res.body.id).toBeDefined();
    });
});