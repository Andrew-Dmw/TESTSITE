const request = require('supertest');
const app = require('../index');

describe('Формально-юридическая модель - API тесты', () => {
    // 1. Тест отзыва согласия
    describe('POST /revoke-consent', () => {
        it('должен вернуть 400, если email не указан', async () => {
            const res = await request(app)
                .post('/revoke-consent')
                .send({})
                .expect(400);
            expect(res.text).toContain('Некорректный email');
        });
        
        it('должен вернуть 404 для несуществующего email', async () => {
            const res = await request(app)
                .post('/revoke-consent')
                .send({ email: 'nonexistent@example.com' })
                .expect(404);
            expect(res.text).toContain('не найден');
        });
        
        // Для реального теста нужен подготовленный пользователь в тестовой БД
        it('должен успешно отозвать согласие для существующего email', async () => {
            const res = await request(app)
                .post('/revoke-consent')
                .send({ email: 'demo@example.com' })
                .expect(200);
            expect(res.text).toContain('Согласие отозвано');
        });
    });

    // 2. Тест удаления данных
    describe('POST /delete-data', () => {
        it('должен вернуть 400 без email', async () => {
            await request(app).post('/delete-data').send({}).expect(400);
        });
        
        it('должен удалить данные demo@example.com', async () => {
            const res = await request(app)
                .post('/delete-data')
                .send({ email: 'demo@example.com' })
                .expect(200);
            expect(res.text).toContain('Данные удалены');
        });
    });

    // 3. Тест экспорта данных
    describe('GET /export-data', () => {
        it('должен вернуть 400 без email', async () => {
            await request(app).get('/export-data').expect(400);
        });
        
        it('должен вернуть JSON для demo@example.com', async () => {
            const res = await request(app)
                .get('/export-data')
                .query({ email: 'demo@example.com' })
                .expect(200)
                .expect('Content-Type', /json/);
            expect(res.body.user.email).toBe('demo@example.com');
            expect(res.body.legal_notice).toContain('ст. 14 ФЗ-152');
        });
    });
});