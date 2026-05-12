const request = require('supertest');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const app = require('../index');
const config = require('../config');

async function loginAndGetAgent(email, password) {
    const agent = request.agent(app);
    await agent.post('/login').send({ email, password }).expect(302);
    return agent;
}

describe('Защита и безопасность', () => {
    let agent;
    beforeAll(async () => {
        agent = await loginAndGetAgent('demo@example.com', 'demo123!');
    });

    it.skip('CSRF-токен обязателен для POST-запросов (кроме GET)', async () => {
        const res = await request(app)
            .post('/revoke-consent')
            .send({ email: 'test@test.com' })
            .expect(403);
        expect(res.text).toBe('Form tampered with');
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
        expect(res.text).toContain('Бот обнаружен');
    });

    it.skip('Rate limiting должен блокировать частые запросы', async () => {
        let blocked = false;
        for (let i = 0; i < 6; i++) {
            const res = await request(app).get('/');
            if (res.status === 429) {
                blocked = true;
                break;
            }
        }
        expect(blocked).toBe(true);
    });
});