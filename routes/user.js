const express = require('express');
const router = express.Router();
const validator = require('validator');
const { logger } = require('../logger');
const pool = require('../db');
const { isAuthenticated } = require('../middleware/auth');
const { getClientIp } = require('../middleware/ip');
const { notifyDataLeak } = require('../utils/notify');

// Все маршруты защищены авторизацией
router.use(isAuthenticated);

const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX) : 100,
    message: "Слишком много запросов..."
});

// Главная после входа
router.get('/main', async (req, res) => {
    const cookieConsent = req.cookies?.cookie_consent;
    const showCookieBanner = !cookieConsent;
    res.render('main', {
        title: 'Главная',
        layout: false,
        csrfToken: res.locals.csrfToken,
        user: {
            name: req.session.userName,
            email: req.session.userEmail,
            role: req.session.userRole
        },
        showCookieBanner: showCookieBanner
    });
});

// ER-страница
router.get('/ER', async (req, res) => {
    res.render('ER', {
        title: "Формально-юридическая модель",
        layout: false,
        user: req.session.userId ? {
            email: req.session.userEmail,
            name: req.session.userName,
            role: req.session.userRole
        } : null
    });
});

// Профиль
router.get('/profile', async (req, res) => {
    res.render('profile', {
        title: 'Профиль пользователя',
        csrfToken: res.locals.csrfToken,
        layout: false,
        user: {
            id: req.session.userId,
            name: req.session.userName,
            email: req.session.userEmail,
            role: req.session.userRole
        }
    });
});

// Логирование cookie
router.post('/log-cookie-consent', limiter, express.json(), async (req, res) => {
    const { consent } = req.body;
    const email = req.session.userEmail;
    const ip = getClientIp(req);
    const ua = req.headers['user-agent'] || '';
    logger.info(`Cookie consent: ${consent}, user: ${email}, IP: ${ip}`);

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.execute(
            'INSERT INTO event_logs (user_email, action, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)',
            [email, 'cookie_consent', `Consent: ${consent}`, ip, ua]
        );
        connection.release();
        res.status(200).json({ status: 'logged' });
    } catch (err) {
        if (connection) connection.release();
        logger.error('Error logging cookie consent: ' + err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Сохранение отзыва
router.post('/save-data', limiter, async (req, res) => {
    if (req.body.honeypot) {
        logger.warn('Honeypot triggered on /save-data, IP: ' + getClientIp(req));
        return res.status(400).json({ error: "Invalid request" });
    }
    try {
        const { Z, Like, COMMENT, dateTime } = req.body;
        const validatedZ = Z ? validator.escape(Z) : null;
        const validatedLike = Like ? validator.escape(Like) : null;
        const validatedCOMMENT = COMMENT ? validator.escape(COMMENT) : null;
        const validatedDateTime = dateTime ? validator.escape(dateTime) : null;

        const connection = await pool.getConnection();
        await connection.execute(
            'INSERT INTO reviews (date_time, liked_website, favorite_section, comment) VALUES (?, ?, ?, ?)',
            [validatedDateTime, validatedZ, validatedLike, validatedCOMMENT]
        );
        connection.release();
        res.redirect('/thank-you');
    } catch (error) {
        console.error('Error saving to database:', error);
        logger.error(`Database error: ${error.message}`);
        res.status(500).redirect('/Server-error');
    }
});

// Отзыв согласия
router.post('/revoke-consent', limiter, async (req, res) => {
    const email = req.session.userEmail;
    if (!email || !validator.isEmail(email)) {
        return res.status(400).send('Некорректный email в сессии');
    }
    if (req.body.honeypot) {
        logger.warn('Honeypot triggered on /revoke-consent, IP: ' + getClientIp(req));
        return res.status(400).json({ error: "Invalid request" });
    }
    let connection;
    try {
        connection = await pool.getConnection();
        const [users] = await connection.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            connection.release();
            return res.status(404).send('Пользователь с таким email не найден.');
        }
        const userId = users[0].id;
        await connection.execute(
            'UPDATE consents SET is_active = FALSE, revoked_at = NOW() WHERE user_id = ? AND is_active = TRUE',
            [userId]
        );
        const ip = getClientIp(req) || '';
        const ua = req.headers['user-agent'] || '';
        await connection.execute(
            'INSERT INTO event_logs (user_email, action, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)',
            [email, 'consent_revoked', 'Отзыв всех согласий', ip, ua]
        );
        connection.release();
        res.redirect('/ER');
    } catch (error) {
        if (connection) connection.release();
        console.error(error);
        res.status(500).redirect('/Server-error');
    }
});

// Удаление данных
router.post('/delete-data', limiter, async (req, res) => {
    const email = req.session.userEmail;
    if (!email || !validator.isEmail(email)) {
        return res.status(400).send('Некорректный email в сессии');
    }
    if (req.body.honeypot) {
        logger.warn('Honeypot triggered on /delete-data, IP: ' + getClientIp(req));
        return res.status(400).json({ error: "Invalid request" });
    }
    let connection;
    try {
        connection = await pool.getConnection();
        const [users] = await connection.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            connection.release();
            return res.status(404).send('Пользователь не найден.');
        }
        const userId = users[0].id;
        await connection.execute('DELETE FROM user_data WHERE user_id = ?', [userId]);
        const ip = getClientIp(req) || '';
        const ua = req.headers['user-agent'] || '';
        await connection.execute(
            'INSERT INTO event_logs (user_email, action, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)',
            [email, 'data_deleted', 'Персональные данные удалены', ip, ua]
        );
        connection.release();
        res.redirect('/ER');
    } catch (error) {
        if (connection) connection.release();
        console.error(error);
        res.status(500).redirect('/Server-error');
    }
});

// Экспорт данных
router.get('/export-data', limiter, async (req, res) => {
    const email = req.session.userEmail;
    if (!email || !validator.isEmail(email)) {
        return res.status(400).send('Некорректный email в сессии');
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const ip = getClientIp(req);

        const [rows] = await connection.execute(
            `SELECT COUNT(*) as cnt FROM event_logs 
             WHERE action = 'data_exported' AND ip_address = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE)`,
            [ip]
        );

        if (rows[0].cnt >= 3) {
            await connection.execute(
                `INSERT INTO security_incident_logs (incident_time, description, status, user_email, ip_address)
                 VALUES (NOW(), ?, 'detected', ?, ?)`,
                [`Частые экспорты данных (${rows[0].cnt} за минуту) с IP ${ip}`, email, ip]
            );
            await notifyDataLeak(email, ip, `С IP ${ip} выполнено ${rows[0].cnt} экспортов за 1 минуту`);
            connection.release();
            return res.status(429).json({ error: 'Превышен лимит запросов на экспорт данных' });
        }

        const [users] = await connection.execute('SELECT id, name, email, created_at FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            connection.release();
            return res.status(404).send('Пользователь не найден.');
        }
        const user = users[0];
        const [dataRows] = await connection.execute('SELECT field_name, field_value FROM user_data WHERE user_id = ?', [user.id]);
        const [consents] = await connection.execute(
            'SELECT purpose, is_active, given_at, revoked_at FROM consents WHERE user_id = ?',
            [user.id]
        );

        const exportData = {
            user: { id: user.id, name: user.name, email: user.email, registered_at: user.created_at },
            custom_fields: dataRows,
            consents_history: consents,
            export_date: new Date().toISOString(),
            legal_notice: 'Данные предоставлены в соответствии со ст. 14 ФЗ-152 "О персональных данных"'
        };

        const ipLog = ip || '';
        const ua = req.headers['user-agent'] || '';
        await connection.execute(
            'INSERT INTO event_logs (user_email, action, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)',
            [email, 'data_exported', 'Скачана копия ПДн', ipLog, ua]
        );
        connection.release();

        res.setHeader('Content-disposition', `attachment; filename=personal_data_${email}.json`);
        res.setHeader('Content-type', 'application/json');
        res.send(JSON.stringify(exportData, null, 2));
    } catch (error) {
        if (connection) connection.release();
        console.error(error);
        res.status(500).redirect('/Server-error');
    }
});

// Обратная связь
router.post('/submit-feedback', limiter, express.json(), async (req, res) => {
    const { feedback } = req.body;
    if (!feedback || typeof feedback !== 'string' || feedback.trim() === '') {
        return res.status(400).json({ error: "No feedback provided" });
    }
    if (req.body.honeypot) {
        logger.warn('Honeypot triggered on /submit-feedback, IP: ' + getClientIp(req));
        return res.status(400).json({ error: "Invalid request" });
    }
    try {
        const connection = await pool.getConnection();
        const [result] = await connection.execute('INSERT INTO feedback (feedback) VALUES (?)', [feedback.trim()]);
        connection.release();
        console.log(`Фидбек сохранён, ID = ${result.insertId}`);
        res.status(200).json({ message: "Feedback saved", id: result.insertId });
    } catch (error) {
        console.error("Ошибка БД при сохранении фидбека:", error);
        res.status(500).json({ error: "Database error" });
    }
});

module.exports = router;