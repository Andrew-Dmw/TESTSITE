const request = require('supertest');
const app = require('../index');
const { ensureDemoUser, TEST_USER } = require('./helpers');

beforeAll(async () => {
    await ensureDemoUser();
});

describe('API формально-юридической модели', () => {
    let demoAgent;

    beforeAll(async () => {
        demoAgent = request.agent(app);
        await demoAgent
            .post('/login')
            .send({ email: TEST_USER.email, password: TEST_USER.password })
            .expect(302);
    });

    // ... остальные тесты без изменений, только поправьте проверку legal_notice
    it('GET /export-data должен вернуть JSON с данными', async () => {
        const res = await demoAgent.get('/export-data').expect(200);
        expect(res.body.legal_notice).toContain('ФЗ-152'); // вместо '152-ФЗ'
    });
    // ...
});