const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const validator = require('validator');
const { logger } = require('../logger');
const pool = require('../db');
const { getClientIp } = require('../middleware/ip');
const pepper = process.env.PASSWORD_PEPPER || require('../config').pepper;

// Ограничитель запросов (передаётся из index.js, но пока оставим локальный)
// Можно импортировать из index.js, но проще продублировать настройку
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX) : 100,
    message: "Слишком много запросов..."
});

// Регистрация
router.post('/register', limiter, async (req, res) => {
    const { email, name, password, privacyConsent } = req.body;
        if (!email || !validator.isEmail(email)) {
            return res.status(400).json({ error: 'Некорректный email' });
        }
        if (!name || name.trim().length < 2) {
            return res.status(400).json({ error: 'Имя должно быть не менее 2 символов' });
        }
        if (!password || password.length < 8) {
            return res.status(400).json({ error: 'Пароль должен быть не менее 8 символов' });
        }
    
        if (!privacyConsent) {
            return res.status(400).json({ error: 'Необходимо согласие с политикой конфиденциальности' });
        }
        if (req.body.honeypot) {
            logger.warn('Honeypot triggered on /register, IP: ' + getClientIp(req));
            return res.status(400).json({ error: "Invalid request" });
        }
    
        let connection;
        try {
            connection = await pool.getConnection();
            const [existing] = await connection.execute('SELECT id FROM users WHERE email = ?', [email]);
            if (existing.length > 0) {
                connection.release();
                return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
            }
    
            // Хеширование пароля с пиппером
            const pepperedPassword = password + pepper;
            const saltRounds = 10;
            const passwordHash = await bcrypt.hash(pepperedPassword, saltRounds);
    
            const [result] = await connection.execute(
                'INSERT INTO users (email, name, password_hash, privacy_consent_given, privacy_consent_date) VALUES (?, ?, ?, ?, NOW())',
                [email, name.trim(), passwordHash, true]
            );
            const userId = result.insertId;
    
            // Запись согласия
            await connection.execute(
                'INSERT INTO consents (user_id, purpose, version, is_active, given_at, ip_address, user_agent) VALUES (?, ?, ?, ?, NOW(), ?, ?)',
                [userId, 'privacy_policy', 'v1.0', true, getClientIp(req), req.headers['user-agent'] || '']
            );
    
            // Сразу авторизуем пользователя
            req.session.userRole = 'user';
            req.session.userId = userId;
            req.session.userEmail = email;
            req.session.userName = name.trim();
            logger.info(`Зарегистрирован новый пользователь: ${email}, IP: ${getClientIp(req)}`);
    
            connection.release();
            return res.redirect('/main'); // хотя это JSON-ответ, лучше вернуть JSON с редиректом
        } catch (error) {
            if (connection) connection.release();
            console.error(error);
            return res.status(500).send({ error: 'Ошибка сервера' });
        };
});

// Логин
router.post('/login', limiter, async (req, res) => {
        const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email и пароль обязательны' });
    }
    if (req.body.honeypot) {
        logger.warn('Honeypot triggered on /login, IP: ' + getClientIp(req));
        return res.status(400).json({ error: "Invalid request" });
    }
    let connection;
    try {
        connection = await pool.getConnection();
        // Получаем пользователя вместе с ролью (поле role добавлено в SELECT)
        const [users] = await connection.execute(
            'SELECT id, email, name, password_hash, role FROM users WHERE email = ?',
            [email]
        );
        if (users.length === 0) {
            connection.release();
            logger.warn(`Неудачный вход: ${email}, IP: ${getClientIp(req)}, причина: неверный пароль/email`);
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }
        const user = users[0];
        const pepperedPassword = password + pepper;
        const isValid = await bcrypt.compare(pepperedPassword, user.password_hash);
        if (!isValid) {
            connection.release();
            logger.warn(`Неудачный вход: ${email}, IP: ${getClientIp(req)}, причина: неверный пароль/email`);
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        req.session.userRole = user.role;
        req.session.userId = user.id;
        req.session.userEmail = user.email;
        req.session.userName = user.name;
        connection.release();
        logger.info(`Успешный вход: ${email}, IP: ${getClientIp(req)}, роль: ${user.role}`);
        return res.redirect('/main'); // аналогично регистрации, лучше вернуть JSON с URL
    } catch (error) {
        if (connection) connection.release();
        console.error('Login error:', error); 
        console.error(error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;