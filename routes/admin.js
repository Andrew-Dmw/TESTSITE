const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { logger } = require('../logger');
const pool = require('../db');
const validator = require('validator');

// Middleware проверки прав админа (для всех маршрутов)
const isAdmin = (req, res, next) => {
    if (req.session.userId && req.session.userRole === 'admin') {
        return next();
    }
    logger.warn(`Попытка доступа к админке без прав: ${req.session.userEmail || 'anon'}, IP: ${req.ip}`);
    res.status(403).send('Доступ запрещён');
};

// Применяем проверку ко всем маршрутам в этом файле
router.use(isAdmin);

// Путь к файлу для хранения изменяемых переменных
const ENV_STORAGE = path.join(__dirname, '../admin_env.json');

// ---------- 1. Главная страница админки ----------
router.get('/', (req, res) => {
    res.render('admin/dashboard', {
        title: 'Админ-панель',
        layout: false,
        user: req.session.userName,
        csrfToken: res.locals.csrfToken,
    });
});

// ---------- 2. Получить список переменных окружения (JSON) ----------
router.get('/env', (req, res) => {
    let userSettings = {};
    if (fs.existsSync(ENV_STORAGE)) {
        try {
            userSettings = JSON.parse(fs.readFileSync(ENV_STORAGE, 'utf-8'));
        } catch (e) {
            logger.error('Ошибка чтения admin_env.json: ' + e.message);
        }
    }

    const envList = [
        { 
            key: 'NODE_ENV', 
            value: process.env.NODE_ENV || 'development',
            writable: false 
        },
        { 
            key: 'PORT', 
            value: process.env.PORT || '3000', 
            writable: false 
        },
        { 
            key: 'DB_HOST', 
            value: process.env.DB_HOST || 'localhost', 
            writable: false 
        },
        { 
            key: 'DB_USER', 
            value: process.env.DB_USER || 'root', 
            writable: false 
        },
        { 
            key: 'DB_DATABASE', 
            value: process.env.DB_DATABASE || 'my_diploma_db', 
            writable: false 
        },
        { 
            key: 'SMTP_USER', 
            value: userSettings.SMTP_USER || process.env.SMTP_USER || '', 
            writable: true, secret: false 
        },
        { 
            key: 'SMTP_PASS', 
            value: userSettings.SMTP_PASS ? '••••••••' : '',
            writable: true, secret: true 
        },
        { 
            key: 'API_KEY', 
            value: userSettings.API_KEY ? '••••••••' : '', 
            writable: true, secret: true 
        },
        { 
            key: 'ADMIN_PASS', 
            value: userSettings.ADMIN_PASS ? '••••••••' : '', 
            writable: true, 
            secret: true 
        },
    ];
    res.json(envList);
});

// ---------- 3. Обновить переменные ----------
router.post('/env', express.json(), (req, res) => {
    const updates = req.body;
    let current = {};
    if (fs.existsSync(ENV_STORAGE)) {
        try {
            current = JSON.parse(fs.readFileSync(ENV_STORAGE, 'utf-8'));
        } catch (e) {}
    }

    const allowedKeys = ['SMTP_USER', 'SMTP_PASS', 'API_KEY', 'ADMIN_PASS'];
    let changed = false;
    allowedKeys.forEach(key => {
        if (updates[key] !== undefined) {
            current[key] = updates[key];
            changed = true;
        }
    });
    if (!changed) {
        return res.status(400).json({ error: 'Нет изменяемых полей' });
    }

    try {
        fs.writeFileSync(ENV_STORAGE, JSON.stringify(current, null, 2));
        logger.info(`Настройки админа обновлены: ${Object.keys(updates).join(', ')}`, {
            user: req.session.userEmail,
            ip: req.ip
        });
        res.json({ status: 'ok' });
    } catch (err) {
        logger.error('Ошибка сохранения admin_env.json: ' + err.message);
        res.status(500).json({ error: 'Ошибка сохранения' });
    }
});

// ---------- 4. Журнал инцидентов (перенесён из index.js) ----------
router.get('/incidents', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [incidents] = await connection.execute(
            'SELECT * FROM security_incident_logs ORDER BY detection_time DESC'
        );
        connection.release();
        res.render('admin/incidents', {
            title: 'Журнал инцидентов безопасности',
            layout: false,
            incidents,
            csrfToken: res.locals.csrfToken,
        });
    } catch (err) {
        if (connection) connection.release();
        logger.error('Ошибка загрузки инцидентов: ' + err.message);
        res.status(500).send('Ошибка загрузки инцидентов');
    }
});

// ---------- 5. Тестовая отправка письма (для проверки SMTP) ----------
router.post('/test-email', express.json(), async (req, res) => {
    const { to } = req.body;
    if (!to || !validator.isEmail(to)) {
        return res.status(400).json({ error: 'Укажите корректный email' });
    }
    try {
        const transporter = require('nodemailer').createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
        await transporter.sendMail({
            from: `"Админ-панель" <${process.env.SMTP_USER}>`,
            to,
            subject: '✅ SMTP работает!',
            html: '<h1>Всё настроено!</h1><p>Это тестовое письмо из админ-панели.</p>'
        });
        res.json({ status: 'ok', message: 'Письмо отправлено' });
    } catch (err) {
        logger.error('Ошибка отправки тестового письма: ' + err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;