// ================================================================
// Подключение необходимых модулей
// ================================================================
const config = require('./config');
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const validator = require('validator');
const expressLayouts = require('express-ejs-layouts');
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

// ================================================================
// Конфигурация Nodemailer (для отправки уведомлений)
// Использует переменные окружения SMTP_*
// ================================================================

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: false, // для порта 587 (STARTTLS)
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

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
// Настройка шаблонизатора EJS + layouts
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
// Layouts для EJS: оборачивает содержимое в layout.ejs
// ================================================================
app.use(expressLayouts);
app.set('layout', 'layout');

// ================================================================
// CSP через Helmet (исправлено)
// Убрали 'unsafe-inline' из scriptSrc, исправили styleSrc, добавили нужные шрифты
// ================================================================
app.use(
    helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://yastatic.net"],
            styleSrc: ["'self'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https://yastatic.net"],
            connectSrc: ["'self'"],
            frameSrc: ["'self'"],
            mediaSrc: ["'self'"],
            objectSrc: ["'none'"],
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

// ================================================================
// CSRF-защита (исправлено)
// Не применяем глобально, только на маршруты с формами.
// Глобально устанавливаем csrfToken для шаблонов.
// ================================================================
// CSRF-защита (всегда включена для нужных маршрутов)
const csrfProtection = csurf({ cookie: false });

app.use((req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
});

// Применяем только к формам, где нужна защита
app.use('/save-data', csrfProtection);
app.use('/revoke-consent', csrfProtection);
app.use('/delete-data', csrfProtection);

// ================================================================
// Middleware для проверки авторизации и ролей
// ================================================================
function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next();
    } else {
        res.status(401).send({ error: 'Необходима авторизация' });
    }
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

// Глобальный rate limiter для всех динамических запросов (кроме статики)
app.use(limiter);

// ================================================================
// МАРШРУТЫ
// ================================================================

// Главная страница (форма авторизации)
app.get('/', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.render('index', {
        title: 'Авторизация',
        csrfToken: res.locals.csrfToken,
        layout: false,
    });
});

// Политика конфиденциальности
app.get('/privacy', (req, res) => {
    res.render('privacy', { title: 'Политика конфиденциальности'});
});

// Главная страница после входа
app.get('/main', isAuthenticated, (req, res) => {
    const cookieConsent = req.cookies?.cookie_consent;
    const showCookieBanner = !cookieConsent;
    res.render('main', {
        title: 'Главная',
        csrfToken: res.locals.csrfToken,
        user: {
            name: req.session.userName,
            email: req.session.userEmail,
            role: req.session.userRole
        },
        showCookieBanner: showCookieBanner
    });
});

// Страница юридической модели (ER)
app.get('/ER', isAuthenticated, (req, res) => {
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

// Профиль пользователя
app.get('/profile', isAuthenticated, (req, res) => {
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

// Журнал инцидентов (только для админа)
app.get('/admin/incidents', isAuthenticated, isAdmin, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [incidents] = await connection.execute(
            'SELECT * FROM security_incident_logs ORDER BY detection_time DESC'
        );
        connection.release();
        res.render('admin_incidents', {
            title: 'Журнал инцидентов безопасности',
            layout: false,
            incidents,
            csrfToken: res.locals.csrfToken
        });
    } catch (err) {
        if (connection) connection.release();
        console.error(err);
        res.status(500).send('Ошибка загрузки инцидентов');
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

// Экспорт данных пользователя (исправлено: блокировка при подозрительной активности)
app.get('/export-data', limiter, isAuthenticated, async (req, res) => {
    const email = req.session.userEmail;
    if (!email || !validator.isEmail(email)) {
        return res.status(400).send('Некорректный email в сессии');
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const ip = getClientIp(req);

        // Проверка на подозрительную активность (частые экспорты)
        const [rows] = await connection.execute(
            `SELECT COUNT(*) as cnt FROM event_logs 
             WHERE action = 'data_exported' AND ip_address = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE)`,
            [ip]
        );

        if (rows[0].cnt >= 3) {
            // Запись инцидента
            await connection.execute(
                `INSERT INTO security_incident_logs (incident_time, description, status, user_email, ip_address)
                 VALUES (NOW(), ?, 'detected', ?, ?)`,
                [`Частые экспорты данных (${rows[0].cnt} за минуту) с IP ${ip}`, email, ip]
            );
            await notifyDataLeak(email, ip, `С IP ${ip} выполнено ${rows[0].cnt} экспортов за 1 минуту`);
            connection.release();
            // Блокируем дальнейший экспорт
            return res.status(429).json({ error: 'Превышен лимит запросов на экспорт данных' });
        }

        // Если всё нормально, продолжаем экспорт
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

        // Логируем факт экспорта
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
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
    if (!passwordRegex.test(password)) {
        return res.status(400).json({ error: 'Пароль должен содержать хотя бы одну букву, одну цифру и один спецсимвол' });
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
        return res.redirect('/main'); // хотя это JSON-ответ, лучше вернуть JSON с редиректом
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
        return res.redirect('/main'); // аналогично регистрации, лучше вернуть JSON с URL
    } catch (error) {
        if (connection) connection.release();
        console.error(error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Страница благодарности после отправки отзыва
app.get('/thank-you', (req, res) => {
    res.render('thank-you', { title: 'Спасибо за ваш отзыв!', redirectUrl: '/main', layout: false });
});

// Страница 500 (внутренняя ошибка сервера)
app.get('/Server-error', (req, res) => {
    res.status(500).render('500', { title: "Внутренняя ошибка сервера" });
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

// ================================================================
// Обработчик 404 – страница не найдена
// ================================================================
app.use((req, res, next) => {
    res.status(404).render('404', { title: 'Страница не найдена' });
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
        console.error(e);
    }
};

// Запускаем, только если файл запущен напрямую (не импортирован для тестов)
if (require.main === module) {
    start();
}

module.exports = app;