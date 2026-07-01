const request = require('supertest');
const app = require('../index');
const { ensureDemoUser, TEST_USER } = require('./helpers');

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

    beforeAll(async () => {
        agent = await loginAndGetAgent(TEST_USER.email, TEST_USER.password);
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
                honeypot: 'anything'
            })
            .expect(400);
        expect(res.body.error).toBe('Invalid request');
    });

    it('Должен отклонить POST без CSRF-токена', async () => {
        const agent2 = request.agent(app);
        await agent2.post('/login').send({ email: TEST_USER.email, password: TEST_USER.password }).expect(302);
        const res = await agent2
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
                agent3.get('/').set('X-Forwarded-For', `10.0.0.${i % 255}`)
            );
        }
        const results = await Promise.allSettled(promises);
        const tooMany = results.filter(r => r.status === 'fulfilled' && r.value.status === 429);
        expect(tooMany.length).toBeGreaterThan(0);
    });
});