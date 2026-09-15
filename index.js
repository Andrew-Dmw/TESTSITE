// ================================================================
// Подключение необходимых модулей
// ================================================================
const config = require('./config');
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const validator = require('validator');
const path = require('path');
const Logger = require('./logger');
const session = require('express-session');
const csurf = require('csurf');
const rateLimit = require("express-rate-limit");
const helmet = require('helmet');
const cors = require('cors');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const nodemailer = require('nodemailer');
const mailer = require('./mailer');

// ================================================================
// Pepper – секретная добавка к паролю перед хешированием
// Берём из process.env или config, чтобы не зависеть от одного источника
// ================================================================
const pepper = process.env.PASSWORD_PEPPER || config.pepper;
if (!pepper) {
    console.error('❌ PASSWORD_PEPPER не задан ни в .env, ни в config');
    process.exit(1);
}

// Создаём экземпляр Express
const app = express();

// ================================================================
// Базовая настройка CORS
// Указываем конкретный origin для безопасности, credentials – для кук
// ================================================================
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000', // если фронтенд на другом домене
    credentials: true, // разрешаем передачу кук (сессия)
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'], // имена заголовков, которые можно слать
}));

// ================================================================
// Раздача статического каталога .well-known (например, для Let's Encrypt)
// ================================================================
app.use('/.well-known', express.static(path.join(__dirname, '.well-known')));

// ================================================================
// Настройка шаблонизатора EJS
// ================================================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());

// ================================================================
// Раздача статических файлов (CSS, JS, картинки) с кешированием
// Для .css и .js отключаем кеш в разработке (no-cache), для остальных долгий кеш
// ================================================================
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.css') || filePath.endsWith('.js') || filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        } else {
            res.setHeader('Cache-Control', 'public, max-age=31536000');
        }
    }
}));

// ================================================================
// CSP через Helmet (исправлено)
// Убрали 'unsafe-inline' из scriptSrc, исправили styleSrc, добавили нужные шрифты
// ================================================================
app.use(
    helmet.contentSecurityPolicy({
        useDefaults: false,
        directives: {
            defaultSrc: ["'self'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'self'"],

            // Скрипты: свои + CDN + Яндекс.Метрика
            scriptSrc: [
                "'self'",
                "https://cdnjs.cloudflare.com",
                "https://yastatic.net",
                "https://mc.yandex.ru",
            ],

            // Стили: свои + Google Fonts + CDN
            styleSrc: [
                "'self'",
                "https://fonts.googleapis.com",
                "https://cdnjs.cloudflare.com",
                "https://yastatic.net",
            ],

            // Шрифты
            fontSrc: [
                "'self'",
                "https://fonts.gstatic.com",
                "https://cdnjs.cloudflare.com",
                "https://yastatic.net",
            ],

            // Картинки: свои + data: + Яндекс
            imgSrc: [
                "'self'",
                "data:",
                "https://yandex.ru",
                "https://mc.yandex.ru",
            ],

            // XHR/fetch/WebSocket — нужно для Метрики
            connectSrc: [
                "'self'",
                "https://mc.yandex.ru",
                "wss://mc.yandex.ru",
            ],

            // Фреймы (Метрика иногда использует для вебвизора)
            frameSrc: [
                "'self'",
                "https://mc.yandex.ru",
                "https://yandex.ru",
            ],

            mediaSrc: ["'self'"],
            objectSrc: ["'none'"],
            workerSrc: ["'self'"],
        },
    })
);

// Доверяем первому прокси (нужно для корректного IP за балансировщиком)
app.set('trust proxy', 1);

// ================================================================
// Настройка пула соединений к БД (было создание нового соединения на каждый запрос)
// Используем pool для переиспользования соединений
// ================================================================
const dbConfig = {
    host: config.db.host,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
};

const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 10, // подберите под ожидаемую нагрузку
    queueLimit: 0,
});

// ================================================================
// Инициализация логгера
// ================================================================
const logger = new Logger({
    logDir: './my-logs',
    level: 'debug'
});

// ================================================================
// Конфигурация окружения (порт и хост)
// ================================================================
const PORT = config.port;
const HOSTNAME = config.HOSTNAME;

// ================================================================
// Сессии (исправлено: secure зависит от окружения, sameSite: 'lax')
// ================================================================
app.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // true только при HTTPS
        httpOnly: true,
        sameSite: 'lax', // безопаснее для навигации
    }
}));

// ================================================================
// Функция уведомления об утечке данных (заглушка, пишет в консоль)
// В реальном проекте здесь может быть отправка email администратору
// ================================================================
async function notifyDataLeak(email, ip, reason) {
    console.log(`\n🚨 [УТЕЧКА ПДн] Обнаружена подозрительная активность:
        👤 Пользователь: ${email}
        🌐 IP-адрес: ${ip}
        📝 Причина: ${reason}
        ⏰ Время: ${new Date().toISOString()}
    `);
    // Здесь можно добавить отправку письма через transporter
}

// ================================================================
// Rate limiting (ограничение количества запросов)
// В тестовой среде лимит выше, чтобы не мешать тестам
// ================================================================
const maxRequests = process.env.RATE_LIMIT_MAX
    ? parseInt(process.env.RATE_LIMIT_MAX)
    : (process.env.NODE_ENV === 'test' ? 10000 : 100);

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: maxRequests,
    message: "Слишком много запросов..."
});

/*
CSRF-защита (исправлено)
CSRF-защита: применяется ко всем не-JSON запросам
*/
const csrfProtection = csurf({ cookie: true });  // ← cookie: true

// Применяем csurf только к не‑JSON запросам
app.use((req, res, next) => {
    if (req.is('application/json')) {
        return next();
    }
    csrfProtection(req, res, next);
});

// Добавляет токен в шаблоны для всех не‑JSON запросов
app.use((req, res, next) => {
    if (!req.is('application/json')) {
        res.locals.csrfToken = req.csrfToken();
    }
    next();
});

// ================================================================
// Middleware для проверки авторизации и ролей
// ================================================================
function isAuthenticated(req, res, next) {
    if (req.session.userId) return next();
    if (req.accepts('html') && !req.is('application/json')) {
        return res.redirect('/login');
    }
    res.status(401).json({ error: 'Необходима авторизация' });
}

function isAdmin(req, res, next) {
    if (req.session.userId && req.session.userRole === 'admin') {
        return next();
    }
    res.status(403).send('Доступ запрещён');
}

// ================================================================
// Вспомогательная функция получения IP клиента
// ================================================================
const getClientIp = (req) => {
    return req.headers['x-forwarded-for'] || req.connection.remoteAddress;
};

// ================================================================
// МАРШРУТЫ
// ================================================================

// ============================================================
// ПУБЛИЧНАЯ ЧАСТЬ
// ============================================================

// Главная страница (лендинг с услугами)
app.get('/', (req, res) => {
    res.render('public/landing', {
        title: 'Юрист в Усть-Куте — Дмитриев Андрей',
        layout: false,
        user: req.session.userId ? {
            name: req.session.userName,
            email: req.session.userEmail,
            role: req.session.userRole
        } : null,
        csrfToken: res.locals.csrfToken,
    });
});

// Страница услуг
app.get('/services', (req, res) => {
    res.render('public/services', {
        title: 'Услуги — Юрист в Усть-Куте',
        layout: false,
        user: req.session.userId ? {
            name: req.session.userName,
            email: req.session.userEmail,
            role: req.session.userRole
        } : null,
        csrfToken: res.locals.csrfToken,
    });
});

// Обо мне
app.get('/about', (req, res) => {
    res.render('public/about', {
        title: 'Обо мне — Дмитриев Андрей',
        layout: false,
        user: req.session.userId ? {
            name: req.session.userName,
            email: req.session.userEmail,
            role: req.session.userRole
        } : null,
        csrfToken: res.locals.csrfToken,
    });
});

// Контакты
app.get('/contacts', (req, res) => {
    res.render('public/contacts', {
        title: 'Контакты — Юрист в Усть-Куте',
        layout: false,
        user: req.session.userId ? {
            name: req.session.userName,
            email: req.session.userEmail,
            role: req.session.userRole
        } : null,
        csrfToken: res.locals.csrfToken,
    });
});

// ============================================================
// АВТОРИЗАЦИЯ (отдельные страницы)
// ============================================================

// Страница входа
app.get('/login', (req, res) => {
    if (req.session.userId) return res.redirect('/profile');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.render('auth/login', {
        title: 'Вход',
        csrfToken: res.locals.csrfToken,
        layout: false,
    });
});

// Страница регистрации
app.get('/register', (req, res) => {
    if (req.session.userId) return res.redirect('/profile');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.render('auth/register', {
        title: 'Регистрация',
        csrfToken: res.locals.csrfToken,
        layout: false,
    });
});

// Политика конфиденциальности
app.get('/privacy', (req, res) => {
    res.render('public/privacy', { 
        title: 'Политика конфиденциальности',
        layout: false
    });
});

// Главная страница после входа
// Личный кабинет
app.get('/main', isAuthenticated, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.render('user/main', {
        title: 'Личный кабинет',
        layout: false,
        csrfToken: res.locals.csrfToken,
        user: {
            name: req.session.userName,
            email: req.session.userEmail,
            role: req.session.userRole
        }
    });
});

// Страница юридической модели (ER)
app.get('/ER', isAuthenticated, (req, res) => {
    res.render('er/index', {
        title: "Демонстрация экспертизы: защита персональных данных",
        layout: false,
        user: req.session.userId ? {
            email: req.session.userEmail,
            name: req.session.userName,
            role: req.session.userRole
        } : null,
        csrfToken: res.locals.csrfToken,
    });
});

// Профиль пользователя
app.get('/profile', isAuthenticated, (req, res) => {
    res.render('user/profile', {
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

// Журнал инцидентов (только для админа)
// Инциденты
app.get('/admin/incidents', isAuthenticated, isAdmin, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        const status = req.query.status;

        // Фильтр по статусу
        let sql = 'SELECT * FROM security_incident_logs';
        const params = [];
        if (status && ['detected', 'investigating', 'resolved'].includes(status)) {
            sql += ' WHERE status = ?';
            params.push(status);
        }
        sql += ' ORDER BY detection_time DESC';

        const [incidents] = await connection.execute(sql, params);

        // Счётчики по статусам
        const [[{ cntDetected }]]      = await connection.execute("SELECT COUNT(*) AS cntDetected FROM security_incident_logs WHERE status='detected'");
        const [[{ cntInvestigating }]] = await connection.execute("SELECT COUNT(*) AS cntInvestigating FROM security_incident_logs WHERE status='investigating'");
        const [[{ cntResolved }]]      = await connection.execute("SELECT COUNT(*) AS cntResolved FROM security_incident_logs WHERE status='resolved'");
        const [[{ cntTotal }]]         = await connection.execute("SELECT COUNT(*) AS cntTotal FROM security_incident_logs");

        connection.release();

        res.render('admin/incidents', {
            title: 'Журнал инцидентов',
            layout: false,
            csrfToken: res.locals.csrfToken,
            user: {
                name: req.session.userName,
                email: req.session.userEmail,
                role: req.session.userRole
            },
            incidents,
            currentFilter: status || 'all',
            counts: {
                detected: cntDetected,
                investigating: cntInvestigating,
                resolved: cntResolved,
                total: cntTotal
            }
        });
    } catch (err) {
        if (connection) connection.release();
        logger.error('Admin incidents error: ' + err.message);
        res.status(500).send('Ошибка загрузки инцидентов');
    }
});

// Смена статуса инцидента
app.post('/admin/incidents/:id/status', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['detected', 'investigating', 'resolved'].includes(status)) {
        return res.status(400).json({ error: 'Некорректный статус' });
    }

    let connection;
    try {
        connection = await pool.getConnection();

        // Получаем текущий статус
        const [rows] = await connection.execute(
            'SELECT status FROM security_incident_logs WHERE id = ?',
            [id]
        );

        if (rows.length === 0) {
            connection.release();
            return res.status(404).json({ error: 'Инцидент не найден' });
        }

        const currentStatus = rows[0].status;

        // Проверяем допустимость перехода
        const allowedTransitions = {
            'detected':      ['investigating', 'resolved'],
            'investigating': ['resolved'],
            'resolved':      ['detected']
        };

        if (!allowedTransitions[currentStatus].includes(status)) {
            connection.release();
            return res.status(400).json({
                error: `Нельзя перевести из "${currentStatus}" в "${status}"`
            });
        }

        // Обновляем статус и, если переводим в resolved, фиксируем notified_at
        if (status === 'resolved') {
            await connection.execute(
                'UPDATE security_incident_logs SET status = ?, notified_at = COALESCE(notified_at, NOW()) WHERE id = ?',
                [status, id]
            );
        } else {
            await connection.execute(
                'UPDATE security_incident_logs SET status = ? WHERE id = ?',
                [status, id]
            );
        }

        connection.release();

        logger.info(`Incident #${id}: статус изменён ${currentStatus} → ${status} (админ: ${req.session.userEmail})`);
        res.json({ ok: true, from: currentStatus, to: status });
    } catch (err) {
        if (connection) connection.release();
        logger.error('Update incident status error: ' + err.message);
        res.status(500).json({ error: 'Ошибка обновления' });
    }
});

// Логирование согласия на куки (исправлено: теперь сохраняет в БД)
app.post('/log-cookie-consent', limiter, express.json(), isAuthenticated, async (req, res) => {
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

// Сохранение отзыва (форма)
app.post('/save-data', limiter, isAuthenticated, async (req, res) => {
    // Honeypot-проверка (боты заполнят скрытое поле)
    if (req.body.honeypot) {
        logger.warn('Honeypot triggered on /save-data, IP: ' + getClientIp(req));
        return res.status(400).json({ error: "Invalid request" }); // не выдаём "Bot detected"
    }
    try {
        const { Z, Like, COMMENT, dateTime } = req.body;
        // Валидация и экранирование
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

// Отзыв согласий на обработку ПДн
app.post('/revoke-consent', limiter, isAuthenticated, async (req, res) => {
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

// Удаление персональных данных
app.post('/delete-data', limiter, isAuthenticated, async (req, res) => {
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

// ================================================================
// Выход из аккаунта
// ================================================================
app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            logger.error('Ошибка при выходе: ' + err.message);
            return res.status(500).send('Не удалось выйти');
        }
        res.clearCookie('connect.sid'); // имя cookie сессии по умолчанию
        res.redirect('/');
    });
});

// ================================================================
// АДМИН-ПАНЕЛЬ
// ================================================================

// Дашборд
app.get('/admin', isAuthenticated, isAdmin, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        const [[{ leadsTotal }]] = await connection.execute('SELECT COUNT(*) AS leadsTotal FROM leads');
        const [[{ leadsNew }]]   = await connection.execute("SELECT COUNT(*) AS leadsNew FROM leads WHERE status = 'new'");
        const [[{ usersTotal }]] = await connection.execute('SELECT COUNT(*) AS usersTotal FROM users');
        const [[{ incidentsTotal }]]    = await connection.execute('SELECT COUNT(*) AS incidentsTotal FROM security_incident_logs');
        const [[{ incidentsDetected }]] = await connection.execute("SELECT COUNT(*) AS incidentsDetected FROM security_incident_logs WHERE status = 'detected'");

        const [recentLeads] = await connection.execute(
            'SELECT id, name, contact, status, created_at FROM leads ORDER BY created_at DESC LIMIT 5'
        );
        const [recentIncidents] = await connection.execute(
            'SELECT id, incident_time, description, status, ip_address FROM security_incident_logs ORDER BY incident_time DESC LIMIT 5'
        );

        connection.release();

        res.render('admin/dashboard', {
            title: 'Панель управления',
            layout: false,
            csrfToken: res.locals.csrfToken,
            user: {
                name: req.session.userName,
                email: req.session.userEmail,
                role: req.session.userRole
            },
            stats: { leadsTotal, leadsNew, usersTotal, incidentsTotal, incidentsDetected },
            recentLeads,
            recentIncidents
        });
    } catch (err) {
        if (connection) connection.release();
        logger.error('Admin dashboard error: ' + err.message);
        res.status(500).send('Ошибка загрузки дашборда');
    }
});

// Заявки
app.get('/admin/leads', isAuthenticated, isAdmin, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const status = req.query.status;
        let sql = 'SELECT * FROM leads';
        const params = [];
        if (status && ['new', 'in_progress', 'done', 'rejected'].includes(status)) {
            sql += ' WHERE status = ?';
            params.push(status);
        }
        sql += ' ORDER BY created_at DESC';
        const [leads] = await connection.execute(sql, params);

        const [[{ cntNew }]]        = await connection.execute("SELECT COUNT(*) AS cntNew FROM leads WHERE status='new'");
        const [[{ cntInProgress }]] = await connection.execute("SELECT COUNT(*) AS cntInProgress FROM leads WHERE status='in_progress'");
        const [[{ cntDone }]]       = await connection.execute("SELECT COUNT(*) AS cntDone FROM leads WHERE status='done'");
        const [[{ cntRejected }]]   = await connection.execute("SELECT COUNT(*) AS cntRejected FROM leads WHERE status='rejected'");

        connection.release();

        res.render('admin/leads', {
            title: 'Заявки',
            layout: false,
            csrfToken: res.locals.csrfToken,
            user: {
                name: req.session.userName,
                email: req.session.userEmail,
                role: req.session.userRole
            },
            leads,
            currentFilter: status || 'all',
            counts: { new: cntNew, in_progress: cntInProgress, done: cntDone, rejected: cntRejected }
        });
    } catch (err) {
        if (connection) connection.release();
        logger.error('Admin leads error: ' + err.message);
        res.status(500).send('Ошибка загрузки заявок');
    }
});

// Смена статуса заявки
app.post('/admin/leads/:id/status', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!['new', 'in_progress', 'done', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Некорректный статус' });
    }
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.execute('UPDATE leads SET status = ? WHERE id = ?', [status, id]);
        connection.release();
        res.json({ ok: true });
    } catch (err) {
        if (connection) connection.release();
        logger.error('Update lead status error: ' + err.message);
        res.status(500).json({ error: 'Ошибка обновления' });
    }
});

// Пользователи
app.get('/admin/users', isAuthenticated, isAdmin, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [users] = await connection.execute(
            'SELECT id, email, name, role, privacy_consent_given, created_at FROM users ORDER BY created_at DESC'
        );
        connection.release();
        res.render('admin/users', {
            title: 'Пользователи',
            layout: false,
            csrfToken: res.locals.csrfToken,
            user: {
                name: req.session.userName,
                email: req.session.userEmail,
                role: req.session.userRole
            },
            users
        });
    } catch (err) {
        if (connection) connection.release();
        logger.error('Admin users error: ' + err.message);
        res.status(500).send('Ошибка загрузки пользователей');
    }
});

// ================================================================
// Проверка SMTP — тестовое письмо
// ================================================================
app.get('/admin/test-email', isAuthenticated, isAdmin, async (req, res) => {
    const to = req.query.to || req.session.userEmail;

    const result = await mailer.sendMail({
        to,
        subject: 'Тестовое письмо — проверка SMTP',
        text: `Это тестовое письмо с сайта «Юрист в Усть-Куте». Если вы его видите — SMTP работает.`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #1e3a8a;">✅ SMTP работает!</h2>
                <p>Это тестовое письмо с сайта «Юрист в Усть-Куте».</p>
                <p>Время отправки: ${new Date().toLocaleString('ru-RU')}</p>
                <p style="color: #64748b; font-size: 13px;">
                    Если вы получили это письмо — почтовая рассылка настроена корректно.
                </p>
            </div>
        `,
    });

    res.json({
        smtpEnabled: mailer.SMTP_ENABLED,
        to,
        result,
        env: {
            SMTP_HOST: process.env.SMTP_HOST || null,
            SMTP_PORT: process.env.SMTP_PORT || null,
            SMTP_USER: process.env.SMTP_USER ? process.env.SMTP_USER.slice(0, 5) + '...' : null,
            ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'dmitrievandreu.law@mail.ru (по умолчанию)',
        },
    });
});


// Обратная связь (JSON-эндпоинт)
app.post('/submit-feedback', limiter, express.json(), isAuthenticated, async (req, res) => {
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

// ============================================================
// Приём заявок с сайта (лиды)
// ============================================================
app.post('/submit-lead', limiter, express.json(), async (req, res) => {
    const { name, contact, message, privacyConsent, source } = req.body;

    // Honeypot
    if (req.body.honeypot) {
        logger.warn('Honeypot triggered on /submit-lead, IP: ' + getClientIp(req));
        return res.status(400).json({ error: 'Invalid request' });
    }

    // Валидация
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({ error: 'Укажите имя (минимум 2 символа)' });
    }
    if (!contact || typeof contact !== 'string' || contact.trim().length < 5) {
        return res.status(400).json({ error: 'Укажите телефон или Telegram' });
    }
    if (!privacyConsent) {
        return res.status(400).json({ error: 'Необходимо согласие с политикой конфиденциальности' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const ip = getClientIp(req) || '';
        const ua = req.headers['user-agent'] || '';
        const cleanSource = (source || 'direct').toString().slice(0, 100);

        const [result] = await connection.execute(
            `INSERT INTO leads (name, contact, message, source, ip_address, user_agent)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                validator.escape(name.trim()),
                validator.escape(contact.trim()),
                message ? validator.escape(message.trim().slice(0, 2000)) : null,
                cleanSource,
                ip,
                ua
            ]
        );
        const leadId = result.insertId;
        connection.release();

        // Отправляем уведомление вам на email
        try {
            // Уведомление администратору (в фоне)
            mailer.sendLeadNotification({
                id: leadId,
                name: name.trim(),
                contact: contact.trim(),
                message: message ? message.trim() : null,
                source: cleanSource,
                ip: ip,
            }).then((result) => {
                if (result.ok) {
                    logger.info(`Lead #${leadId}: notification sent`);
                } else if (result.skipped) {
                    logger.info(`Lead #${leadId}: notification skipped (SMTP не настроен)`);
                } else {
                    logger.error(`Lead #${leadId}: notification failed — ${result.error}`);
                }
            });
        } catch (mailErr) {
            logger.error('Ошибка отправки email о заявке: ' + mailErr.message);
        }

        res.status(200).json({ ok: true, id: leadId });
    } catch (err) {
        if (connection) connection.release();
        logger.error('Ошибка сохранения заявки: ' + err.message);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Регистрация пользователя
app.post('/register', limiter, async (req, res) => {
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

        connection.release();
        // Отправляем приветственное письмо (не блокирует ответ)
        mailer.sendWelcomeEmail({
            name: name.trim(),
            email: email,
        }).then((result) => {
            if (result.ok) {
                logger.info(`Welcome email sent to ${email}, id: ${result.messageId}`);
            } else if (result.skipped) {
                logger.info(`Welcome email skipped (SMTP не настроен) для ${email}`);
            } else {
                logger.error(`Welcome email failed for ${email}: ${result.error}`);
            }
        });
        return res.redirect('/profile'); // хотя это JSON-ответ, лучше вернуть JSON с редиректом
    } catch (error) {
        if (connection) connection.release();
        console.error(error);
        return res.status(500).send({ error: 'Ошибка сервера' });
    }
});

// Вход пользователя (JSON)
app.post('/login', limiter, async (req, res) => {
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
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }
        const user = users[0];
        const pepperedPassword = password + pepper;
        const isValid = await bcrypt.compare(pepperedPassword, user.password_hash);
        if (!isValid) {
            connection.release();
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        req.session.userRole = user.role;
        req.session.userId = user.id;
        req.session.userEmail = user.email;
        req.session.userName = user.name;
        connection.release();
        return res.redirect('/profile'); // аналогично регистрации, лучше вернуть JSON с URL
    } catch (error) {
        if (connection) connection.release();
        console.error('Login error:', error); 
        console.error(error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Страница благодарности после отправки отзыва
app.get('/thank-you', (req, res) => {
    res.render('public/thank-you', { title: 'Спасибо за ваш отзыв!', redirectUrl: '/main', layout: false });
});

// Страница 500 (внутренняя ошибка сервера)
app.get('/Server-error', (req, res) => {
    res.status(500).render('errors/500', { title: "Внутренняя ошибка сервера" });
});

// ================================================================
// Обработчик ошибок CSRF (если где-то всё же промахнулись)
// ================================================================
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        res.status(403).send('Form tampered with');
    } else {
        next(err);
    }
});

// ================================================================
// Логирование всех запросов (после всех маршрутов, чтобы не дублироваться)
// ================================================================
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

// Обработчик необработанных ошибок
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

// ================================================================
// Обработчик 404 – страница не найдена
// ================================================================
app.use((req, res, next) => {
    res.status(404).render('errors/404', { title: 'Страница не найдена' });
});

// ================================================================
// Запуск сервера
// ================================================================
const start = () => {
    try {
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`✅ HTTP Server started on: http://localhost:${PORT}`);
            console.log(`Process PID: ${process.pid}`);
            logger.info('server start');
        });
    } catch (e) {
        logger.error(`Server error: ${e.message}`);
        console.error('Login error:', error);
        console.error(e);
    }
};

// Запускаем, только если файл запущен напрямую (не импортирован для тестов)
if (require.main === module) {
    start();
}

module.exports = app;
module.exports.pool = pool;