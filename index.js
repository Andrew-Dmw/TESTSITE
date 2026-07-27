// ================================================================
// Подключение необходимых модулей
// ================================================================
const config = require('./config');
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const { logger } = require('./logger');
const session = require('express-session');
const csurf = require('@dr.pogodin/csurf');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const nodemailer = require('nodemailer');
const pool = require('./db');

// Импорт роутеров
const adminRoutes = require('./routes/admin');
const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');

// ================================================================
// Конфигурация Nodemailer
// ================================================================
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true' || true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

transporter.verify((error, success) => {
    if (error) {
        console.error('❌ SMTP не работает:', error.message);
        logger.warn('Письма не будут доставляться пользователям');
    } else {
        console.log('✅ SMTP настроен, письма летают!');
    }
});

// ================================================================
// Pepper
// ================================================================
const pepper = process.env.PASSWORD_PEPPER || config.pepper;
if (!pepper) {
    console.error('❌ PASSWORD_PEPPER не задан ни в .env, ни в config');
    logger.warn('Пароли будут менее защищены');
}

// ================================================================
// Экземпляр Express
// ================================================================
const app = express();
const PORT = config.port;

// ================================================================
// Middleware
// ================================================================
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
}));

app.use('/.well-known', express.static(path.join(__dirname, '.well-known')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());

app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.css') || filePath.endsWith('.js') || filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        } else {
            res.setHeader('Cache-Control', 'public, max-age=31536000');
        }
    }
}));

app.use(expressLayouts);
app.set('layout', 'layout');

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

app.set('trust proxy', 1);

// Сессии
app.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
    }
}));

// CSRF
const csrfProtection = csurf({ cookie: true });
app.use((req, res, next) => {
    if (req.is('application/json')) {
        return next();
    }
    csrfProtection(req, res, next);
});
app.use((req, res, next) => {
    if (!req.is('application/json')) {
        res.locals.csrfToken = req.csrfToken();
    }
    next();
});

// ================================================================
// Подключение маршрутов
// ================================================================
app.use('/', publicRoutes);
app.use('/', authRoutes);
app.use('/', userRoutes);
app.use('/admin', adminRoutes);

// ================================================================
// Обработчики ошибок
// ================================================================
// CSRF
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        res.status(403).send('Form tampered with');
    } else {
        next(err);
    }
});

// 404
app.use((req, res) => {
    res.status(404).render('404', { title: 'Страница не найдена' });
});

// Логирование всех запросов (после маршрутов)
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

// Общий обработчик ошибок
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
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

if (require.main === module) {
    start();
}

module.exports = app;