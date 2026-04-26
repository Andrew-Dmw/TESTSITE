const request = require('supertest');
const app = require('../index');

describe('Защита и безопасность', () => {
    it('CSRF-токен обязателен для POST-запросов (кроме GET)', async () => {
        const res = await request(app)
            .post('/revoke-consent')
            .send({ email: 'test@test.com' })
            .expect(403);
        expect(res.text).toBe('Form tampered with');
    });

    it('Honeypot должен блокировать ботов', async () => {
        const res = await request(app)
            .post('/save-data')
            .field('Z', 'v')
            .field('Like', 'cats')
            .field('COMMENT', 'test')
            .field('dateTime', '2025-07-30T14:47')
            .field('honeypot', 'anything') // заполненное поле-ловушка
            .expect(400);
        expect(res.text).toContain('Бот обнаружен');
    });

    it('Rate limiting должен блокировать частые запросы', async () => {
        const promises = [];
        for (let i = 0; i < 110; i++) { // превышаем лимит 100 за 15 минут
            promises.push(request(app).get('/'));
        }
        const responses = await Promise.all(promises);
        const tooMany = responses.filter(r => r.status === 429);
        expect(tooMany.length).toBeGreaterThan(0);
    });
});