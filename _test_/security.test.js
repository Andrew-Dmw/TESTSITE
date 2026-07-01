const request = require('supertest');
const app = require('../index');

async function loginAndGetAgent(email, password) {
    const agent = request.agent(app);
    await agent.post('/login').send({ email, password }).expect(302);
    return agent;
}

describe('Защита и безопасность', () => {
    let agent;

    beforeAll(async () => {
        // Используем демо-пользователя (должен быть в тестовой БД)
        agent = await loginAndGetAgent('demo@example.com', 'demo123!');
    });

    it('Honeypot должен блокировать ботов (сообщение Invalid request)', async () => {
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

    it('Должен отклонить POST-запрос без CSRF-токена', async () => {
        // Создаём нового агента, логинимся, но не извлекаем csrf-токен из страницы.
        const agent2 = request.agent(app);
        await agent2.post('/login').send({ email: 'demo@example.com', password: 'demo123!' }).expect(302);
        // Теперь отправляем POST без _csrf
        const res = await agent2
            .post('/save-data')
            .type('form')
            .send({ Z: 'v', Like: 'tests', COMMENT: 'test', dateTime: '2025-07-30T14:47' });
        expect(res.status).toBe(403);
    });

    it('Rate limiting должен блокировать чрезмерное количество запросов', async () => {
        const agent3 = request.agent(app);
        const promises = [];
        for (let i = 0; i < 30; i++) { // уменьшено число запросов для стабильности
            promises.push(
                agent3.get('/').set('X-Forwarded-For', `1.2.3.${i % 255}`)
            );
        }
        const results = await Promise.allSettled(promises);
        const tooMany = results.filter(r => r.status === 'fulfilled' && r.value.status === 429);
        expect(tooMany.length).toBeGreaterThan(0);
    });
});