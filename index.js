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

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: false, // для порта 587
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});



const pepper = config.pepper;
if (!pepper) {
    console.error('❌ PASSWORD_PEPPER не задан в .env');
    process.exit(1);
}
const app = express();

// EJS setup
app.use(cors());
app.use('/.well-known', express.static(path.join(__dirname, '.well-known')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.css')) {
            res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        } else if (filePath.endsWith('.js')) {
            res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        } else if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        } else {
            res.setHeader('Cache-Control', 'public, max-age=31536000');
        }
    }
}));

app.use(expressLayouts);
app.set('layout', 'layout');

// Helmet CSP
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://yastatic.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://yastatic.net"],
      connectSrc: ["'self'"],
      frameSrc: ["'self'"],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
    },
  })
);
app.set('trust proxy', true);

// Database config
const dbConfig = {
    host: config.db.host,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database
};

// Logger
const logger = new Logger({
    logDir: './my-logs',
    level: 'debug'
});

// Environment
const PORT = config.port;
const HOSTNAME = config.HOSTNAME;

// Session
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    sameSite: 'strict'
  }
}));

app.use(helmet());

async function notifyDataLeak(email, ip, reason) {
    console.log(`\n🚨 [УТЕЧКА ПДн] Обнаружена подозрительная активность:
        👤 Пользователь: ${email}
        🌐 IP-адрес: ${ip}
        📝 Причина: ${reason}
        ⏰ Время: ${new Date().toISOString()}
    `);
}

// Rate limiting
const maxRequests = process.env.NODE_ENV === 'test' ? 10000 : (process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX) : 100);
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: maxRequests,
    message: "Слишком много запросов..."
});

// CSRF: отключаем для тестов
if (process.env.NODE_ENV !== 'test') {
  const csrfProtection = csurf({ cookie: false });
  app.use(csrfProtection);
  app.use((req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
  });
} else {
  app.use((req, res, next) => {
    res.locals.csrfToken = 'test-token';
    next();
  });
}

// Middleware isAuthenticated
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

// Получение IP
const getClientIp = (req) => {
    return req.headers['x-forwarded-for'] || req.connection.remoteAddress;
};

// ---------- Маршруты ----------
app.get('/', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.render('index', {title: 'Авторизация', csrfToken: res.locals.csrfToken, layout: false,});
});

app.get('/privacy', (req, res) => {
    res.render('privacy', { title: 'Политика конфиденциальности'});
});

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

app.get('/ER', isAuthenticated, (req, res) => {
    res.render('ER', {
        title: "Формально-юридическая модель",
        layout: false,
        user: 
        req.session.userId ? 
        {
            email: req.session.userEmail,
            name: req.session.userName,
            role: req.session.userRole
        } : null
    });
});

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

app.get('/admin/incidents', isAuthenticated, isAdmin, async (req, res) => {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const [incidents] = await connection.execute(
            'SELECT * FROM security_incident_logs ORDER BY detection_time DESC'
        );
        await connection.end();
        res.render('admin_incidents', {
            title: 'Журнал инцидентов безопасности',
            layout: false,
            incidents,
            csrfToken: res.locals.csrfToken
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка загрузки инцидентов');
    }
});

app.post('/log-cookie-consent', limiter, express.json(), isAuthenticated, async (req, res) => {
    const { consent } = req.body;
    const email = req.session.userEmail;
    const ip = getClientIp(req);
    console.log(`Cookie consent: ${consent}, user: ${email}, IP: ${ip}, time: ${new Date().toISOString()}`);
    res.status(200).json({ status: 'logged' });
});

app.post('/save-data', limiter, isAuthenticated, async (req, res) => {
    try {
        const { Z, Like, COMMENT, dateTime, honeypot } = req.body;
        if (honeypot) {
            console.log("Бот обнаружен!");
            return res.status(400).send("Бот обнаружен.");
        }
        const validatedZ = Z ? validator.escape(Z) : null;
        const validatedLike = Like ? validator.escape(Like) : null;
        const validatedCOMMENT = COMMENT ? validator.escape(COMMENT) : null;
        const validatedDateTime = dateTime ? validator.escape(dateTime) : null;
        const connection = await mysql.createConnection(dbConfig);
        await connection.execute(
            'INSERT INTO reviews (date_time, liked_website, favorite_section, comment) VALUES (?, ?, ?, ?)',
            [validatedDateTime, validatedZ, validatedLike, validatedCOMMENT]
        );
        await connection.end();
        res.redirect('/thank-you');
    } catch (error) {
        console.error('Error saving to database:', error);
        logger.error(`Database error: ${error.message}`);
        res.status(500).redirect('/Server-error');
    }
});

app.post('/revoke-consent', limiter, isAuthenticated, async (req, res) => {
    const email = req.session.userEmail;
    if (!email || !validator.isEmail(email)) {
        return res.status(400).send('Некорректный email в сессии');
    }
    if (req.body.honeypot) {
        console.log("Бот обнаружен!");
        return res.status(400).json({ error: "Bot detected" });
    }
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const [users] = await connection.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            await connection.end();
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
        await connection.end();
        res.redirect('/ER');
    } catch (error) {
        console.error(error);
        if (connection) await connection.end();
        res.status(500).redirect('/Server-error');
    }
});

app.post('/delete-data', limiter, isAuthenticated, async (req, res) => {
    const email = req.session.userEmail;
    if (!email || !validator.isEmail(email)) {
        return res.status(400).send('Некорректный email в сессии');
    }
    if (req.body.honeypot) {
        console.log("Бот обнаружен!");
        return res.status(400).json({ error: "Bot detected" });
    }
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const [users] = await connection.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            await connection.end();
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
        await connection.end();
        res.redirect('/ER');
    } catch (error) {
        console.error(error);
        if (connection) await connection.end();
        res.status(500).redirect('/Server-error');
    }
});

app.get('/export-data', limiter, isAuthenticated, async (req, res) => {
    const email = req.session.userEmail;
    if (!email || !validator.isEmail(email)) {
        return res.status(400).send('Некорректный email в сессии');
    }
    if (req.body.honeypot) {
        console.log("Бот обнаружен!");
        return res.status(400).json({ error: "Bot detected" });
    }
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const ip = getClientIp(req);

        // Проверка на подозрительную активность (частые экспорты)
        const [rows] = await connection.execute(
            `SELECT COUNT(*) as cnt FROM event_logs 
             WHERE action = 'data_exported' AND ip_address = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE)`,
            [ip]
        );
        if (rows[0].cnt >= 3) {
            // Запись инцидента в таблицу security_incident_logs
            await connection.execute(
                `INSERT INTO security_incident_logs (incident_time, description, status, user_email, ip_address)
                 VALUES (NOW(), ?, 'detected', ?, ?)`,
                [`Частые экспорты данных (${rows[0].cnt} за минуту) с IP ${ip}`, email, ip]
            );
            // Логируем в консоль
            await notifyDataLeak(email, ip, `С IP ${ip} выполнено ${rows[0].cnt} экспортов за 1 минуту`);
        }

        // Основная логика экспорта
        const [users] = await connection.execute('SELECT id, name, email, created_at FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            await connection.end();
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
        await connection.end();

        res.setHeader('Content-disposition', `attachment; filename=personal_data_${email}.json`);
        res.setHeader('Content-type', 'application/json');
        res.send(JSON.stringify(exportData, null, 2));
    } catch (error) {
        console.error('Export error details:', error.stack);
        if (connection) await connection.end();
        res.status(500).redirect('/Server-error');
    }
});

app.post('/submit-feedback', limiter, express.json(), isAuthenticated, async (req, res) => {
    const { feedback } = req.body;
    if (!feedback || typeof feedback !== 'string' || feedback.trim() === '') {
        return res.status(400).json({ error: "No feedback provided" });
    }
    if (req.body.honeypot) {
        console.log("Бот обнаружен!");
        return res.status(400).json({ error: "Bot detected" });
    }
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [result] = await connection.execute('INSERT INTO feedback (feedback) VALUES (?)', [feedback.trim()]);
        await connection.end();
        console.log(`Фидбек сохранён, ID = ${result.insertId}`);
        res.status(200).json({ message: "Feedback saved", id: result.insertId });
    } catch (error) {
        console.error("Ошибка БД при сохранении фидбека:", error);
        res.status(500).json({ error: "Database error" });
    }
});

app.post('/register', limiter, express.json(), async (req, res) => {
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
    if (req.body.honeypot) {
        console.log("Бот обнаружен!");
        return res.status(400).json({ error: "Bot detected" });
    }
    if (!privacyConsent) {
        return res.status(400).json({ error: 'Необходимо согласие с политикой конфиденциальности' });
    }

    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const [existing] = await connection.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            await connection.end();
            return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
        }

        const pepperedPassword = password + pepper;
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(pepperedPassword, saltRounds);

        const [result] = await connection.execute(
            'INSERT INTO users (email, name, password_hash, privacy_consent_given, privacy_consent_date) VALUES (?, ?, ?, ?, NOW())',
            [email, name.trim(), passwordHash, true]
        );
        const userId = result.insertId;

        await connection.execute(
            'INSERT INTO consents (user_id, purpose, version, is_active, given_at, ip_address, user_agent) VALUES (?, ?, ?, ?, NOW(), ?, ?)',
            [userId, 'privacy_policy', 'v1.0', true, getClientIp(req), req.headers['user-agent'] || '']
        );

        req.session.userRole = 'user';
        req.session.userId = userId;
        req.session.userEmail = email;
        req.session.userName = name.trim();

        await connection.end();
        return res.redirect('/main');
    } catch (error) {
        if (connection) await connection.end();
        console.error(error);
        return res.status(500).send({ error: 'Ошибка сервера' });
    }
});

app.post('/login', limiter, express.json(), async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email и пароль обязательны' });
    }
    if (req.body.honeypot) {
        console.log("Бот обнаружен!");
        return res.status(400).json({ error: "Bot detected" });
    }
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        // ----- ИСПРАВЛЕНО: добавлено поле role в SELECT -----
        const [users] = await connection.execute(
            'SELECT id, email, name, password_hash, role FROM users WHERE email = ?',
            [email]
        );
        if (users.length === 0) {
            await connection.end();
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }
        const user = users[0];
        const pepperedPassword = password + pepper;
        const isValid = await bcrypt.compare(pepperedPassword, user.password_hash);
        if (!isValid) {
            await connection.end();
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        req.session.userRole = user.role;
        req.session.userId = user.id;
        req.session.userEmail = user.email;
        req.session.userName = user.name;
        await connection.end();
        return res.redirect('/main');
    } catch (error) {
        if (connection) await connection.end();
        console.error(error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/thank-you', (req, res) => {
    res.render('thank-you', { title: 'Спасибо за ваш отзыв!', redirectUrl: '/main', layout: false, });
});

app.get('/Server-error', (req, res) => {
    res.status(500).render('500', { title: "Внутренняя ошибка сервера" });
});

app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        res.status(403).send('Form tampered with');
    } else {
        next(err);
    }
});

app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", '*');
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.use((req, res, next) => {
    res.status(404).render('404', { title: 'Страница не найдена' });
});

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

if (require.main === module) {
    start();
}
module.exports = app;