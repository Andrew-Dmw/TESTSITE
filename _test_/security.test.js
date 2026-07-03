const request = require('supertest');
const app = require('../index');
const { ensureDemoUser, TEST_USER } = require('./helpers');
const pool = app.pool;
const pool = require('../index').pool;
afterAll(async () => {
    if (pool) await pool.end();
});

beforeAll(async () => {
    await ensureDemoUser();
});

async function loginAndGetAgent(email, password) {
    const agent = request.agent(app);
    await agent.post('/login').send({ email, password }).expect(302);
    return agent;
}

describe('Защита и безопасность', () => {
    let agent;
    let csrfToken;   // добавим переменную

    beforeAll(async () => {
        agent = await loginAndGetAgent(TEST_USER.email, TEST_USER.password);
        // Получаем CSRF-токен: csurf выставит куку при любом не‑JSON запросе
        const res = await agent.get('/main');
        const cookies = res.headers['set-cookie'] || [];
        const csrfCookie = cookies.find(c => c.startsWith('_csrf='));
        if (csrfCookie) {
            csrfToken = csrfCookie.split(';')[0].split('=')[1];
        }
    });

    it('Honeypot должен блокировать ботов', async () => {
        const res = await agent
            .post('/save-data')
            .type('form')
            .send({
                Z: 'v',
                Like: 'cats',
                COMMENT: 'test',
                dateTime: '2025-07-30T14:47',
                honeypot: 'anything',
                _csrf: csrfToken            // ← передаём токен
            })
            .expect(400);
        expect(res.body.error).toBe('Invalid request');
    });

    it('Должен отклонить POST без CSRF-токена', async () => {
        const freshAgent = request.agent(app);
        const res = await freshAgent
            .post('/save-data')
            .type('form')
            .send({ Z: 'v', Like: 'tests', COMMENT: 'test', dateTime: '2025-07-30T14:47' });
        expect(res.status).toBe(403);
    });

    it('Rate limiting должен блокировать частые запросы', async () => {
        const agent3 = request.agent(app);
        const promises = [];
        for (let i = 0; i < 15; i++) {
            promises.push(
                agent3
                    .post('/login')
                    .set('X-Forwarded-For', '10.0.0.99')
                    .send({ email: 'no-reply@test.com', password: 'wrong' })
            );
        }
        const results = await Promise.allSettled(promises);
        const tooMany = results.filter(r => r.status === 'fulfilled' && r.value.status === 429);
        expect(tooMany.length).toBeGreaterThan(0);
    });
});