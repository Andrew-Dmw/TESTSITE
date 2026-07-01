const request = require('supertest');
const app = require('../index');

// Вспомогательная функция для логина
async function loginAndGetAgent(email, password) {
    const agent = request.agent(app);
    await agent.post('/login').send({ email, password }).expect(302);
    return agent;
}

describe('Защита и безопасность', () => {

    // ---------- Honeypot ----------
    it('Honeypot должен блокировать ботов (сообщение Invalid request)', async () => {
        const res = await request(app)
            .post('/save-data')
            .type('form')
            .send({
                Z: 'v',
                Like: 'cats',
                COMMENT: 'test',
                dateTime: '2025-07-30T14:47',
                honeypot: 'anything'   // скрытое поле, заполненное ботом
            })
            .expect(400);

        // Проверяем, что ответ содержит общее сообщение об ошибке, а не "Бот обнаружен"
        expect(res.body.error).toBe('Invalid request');
    });

    // ---------- CSRF ----------
    it('Должен отклонить POST-запрос без CSRF-токена (если применимо)', async () => {
        // Создаём агента, но не извлекаем токен
        const agent = request.agent(app);
        // Пытаемся выполнить защищённый POST без токена
        const res = await agent
            .post('/save-data')
            .type('form')
            .send({
                Z: 'v',
                Like: 'tests',
                COMMENT: 'test',
                dateTime: '2025-07-30T14:47'
            });
        // Ожидаем 403 (Form tampered with) – означает, что CSRF отработал
        expect(res.status).toBe(403);
    });

    // ---------- Rate Limiting ----------
    it('Rate limiting должен блокировать чрезмерное количество запросов', async () => {
        const agent = request.agent(app);
        // Делаем много быстрых запросов к конечной точке, которая не требует авторизации
        const promises = [];
        for (let i = 0; i < 150; i++) {
            promises.push(
                agent
                    .get('/')
                    .set('X-Forwarded-For', `1.2.3.${i % 255}`) // имитируем разные IP, если нужно обойти лимит на IP
            );
        }
        const responses = await Promise.all(promises);
        // Хотя бы один ответ должен быть 429 (Too Many Requests)
        const tooMany = responses.filter(r => r.status === 429);
        expect(tooMany.length).toBeGreaterThan(0);
    });
});