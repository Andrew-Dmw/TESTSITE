const express = require('express');
const router = express.Router();

// Главная (форма входа)
router.get('/', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.render('index', {
        title: 'Авторизация',
        csrfToken: res.locals.csrfToken,
        layout: false,
    });
});

// Политика конфиденциальности
router.get('/privacy', (req, res) => {
    res.render('privacy', { title: 'Политика конфиденциальности', layout: false });
});

// Страница благодарности
router.get('/thank-you', (req, res) => {
    res.render('thank-you', { title: 'Спасибо за ваш отзыв!', redirectUrl: '/main', layout: false });
});

// Страница 500
router.get('/Server-error', (req, res) => {
    res.status(500).render('500', { title: "Внутренняя ошибка сервера" });
});

module.exports = router;