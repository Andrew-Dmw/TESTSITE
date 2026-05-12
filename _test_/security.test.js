const request = require('supertest');
const app = require('../index');

async function loginAndGetAgent(email, password) {
    const agent = request.agent(app);
    await agent.post('/login').send({ email, password }).expect(302);
    return agent;
}

describe('Защита и безопасность', () => {
    it.skip('Honeypot должен блокировать ботов', async () => {
        const res = await request(app)
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
        expect(res.text).toContain('Бот обнаружен');
    });

    // CSRF и rate limiting пропущены (закомментированы)
    it.skip('CSRF-токен обязателен для POST-запросов', async () => {});
    it.skip('Rate limiting должен блокировать частые запросы', async () => {});
});