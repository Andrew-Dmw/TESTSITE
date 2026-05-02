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
const { title } = require('process');
const cors = require('cors');
const https = require('https');
const fs = require('fs');


const app = express();

// EJS setup
app.use(cors());
app.use('/.well-known', express.static(path.join(__dirname, '.well-known')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.css')) {
            res.setHeader('Cache-Control', 'no-cahe, must-revalidate');
        } else if (filePath.endsWith('.js')) {
            res.setHeader('Cache-Control', 'no-cahe, must-revalidate');
        } else if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        } else {
            res.setHeader('Cache-Control', 'public, max-age=31536000');
        }
    }
}));

app.use(expressLayouts);
app.set('layout', 'layout');

// Middleware for URL-encoded forms
app.use(bodyParser.urlencoded({ extended: false }));

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

// Database config
const dbConfig = {
    host: config.db.host,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database
};

// Logger initialization
const logger = new Logger({
    logDir: './my-logs',
    level: 'debug'
});

// Environment variables or defaults
const PORT = config.port;
const HOSTNAME = config.HOSTNAME;

// Session configuration
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

// Apply Helmet
app.use(helmet());

// Rate limiting - increased max for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Increased max for development
  message: "Слишком много запросов с этого IP, пожалуйста, попробуйте позже через 15 минут."
});
app.post('/submit-feedback', limiter, express.json(), async (req, res) => {
  const { feedback } = req.body;
  if (!feedback || typeof feedback !== 'string' || feedback.trim() === '') {
    return res.status(400).json({ error: "No feedback provided" });
  }
  try {
    const connection = await mysql.createConnection(dbConfig);
    // Вставляем только feedback, created_at автоматически станет NOW()
    const [result] = await connection.execute(
      'INSERT INTO feedback (feedback) VALUES (?)',
      [feedback.trim()]
    );
    await connection.end();
    console.log(`Фидбек сохранён, ID = ${result.insertId}`);
    res.status(200).json({ message: "Feedback saved", id: result.insertId });
  } catch (error) {
    console.error("Ошибка БД при сохранении фидбека:", error);
    res.status(500).json({ error: "Database error" });
  }
});


const csrfProtection = csurf({ cookie: false }); // Использует сессию

app.use(csrfProtection);

// Middleware to pass CSRF token to views
app.use(function (req, res, next) {
    res.locals.csrfToken = req.csrfToken();
    next();
});

// Routes
app.get('/', csrfProtection, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.render('index', { title: 'Главная', csrfToken: req.csrfToken()});
    console.log('web №1 worked');
});

app.get('/contact', (req, res) => {
    res.render('contact', { title: 'Контакты' });
    console.log('web №2 worked');
});
app.get('/ER', (req, res) => {
    res.render('ER', { title: "Формально-юридическая модель", layout: false });
});

// Route for form submission
app.post('/save-data', limiter, csrfProtection, async (req, res) => {
    try {
        console.log("req.body:", req.body);
        const { Z, Like, COMMENT, dateTime, honeypot } = req.body;

        // Honeypot check
        if (honeypot) {
            console.log("Бот обнаружен!");
            return res.status(400).send("Бот обнаружен.");
        }

        // Validation and sanitization
        const validatedZ = Z ? validator.escape(Z) : null;
        const validatedLike = Like ? validator.escape(Like) : null;
        const validatedCOMMENT = COMMENT ? validator.escape(COMMENT) : null;
        const validatedDateTime = dateTime ? validator.escape(dateTime) : null;

        // Database connection
        const connection = await mysql.createConnection(dbConfig);

        // Prepared query
        const query = `
            INSERT INTO reviews (date_time, liked_website, favorite_section, comment)
            VALUES (?, ?, ?, ?)
        `;

        // Execute query with parameters
        const [rows, fields] = await connection.execute(query, [
            validatedDateTime,
            validatedZ,
            validatedLike,
            validatedCOMMENT
        ]);

        console.log('Data saved to database:', rows);
        await connection.end(); // Close connection

        res.redirect('/thank-you'); // Redirect after successful submission

    } catch (error) {
        console.error('Error saving to database:', error);
        logger.error(`Database error: ${error.message}`);
        res.status(500).redirect('/Server-error'); // Generic error message for the user
    }
});

// Вспомогательная функция для получения реального IP (через прокси)
const getClientIp = (req) => {
    return req.headers['x-forwarded-for'] || req.connection.remoteAddress;
};

app.post('/revoke-consent', limiter, csrfProtection, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !validator.isEmail(email)) {
            return res.status(400).send('Некорректный email');
        }

        const connection = await mysql.createConnection(dbConfig);
        
        // Найти пользователя
        const [users] = await connection.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            await connection.end();
            return res.status(404).send('Пользователь с таким email не найден.');
        }
        const userId = users[0].id;

        // Отзываем все активные согласия
        await connection.execute(
            `UPDATE consents 
             SET is_active = FALSE, revoked_at = NOW() 
             WHERE user_id = ? AND is_active = TRUE`,
            [userId]
        );

        // Логируем событие
        await connection.execute(
            `INSERT INTO event_logs (user_email, action, details, ip_address, user_agent)
             VALUES (?, ?, ?, ?, ?)`,
            [email, 'consent_revoked', 'Отзыв всех согласий', getClientIp(req), req.headers['user-agent']]
        );

        await connection.end();

        res.send(`
            <h3>Согласие отозвано</h3>
            <p>Ваши персональные данные будут удалены в течение 30 дней в соответствии со ст. 9 и 21 ФЗ-152.</p>
            <p>Номер обращения зафиксирован в журнале событий.</p>
            <a href="/ER">Вернуться к модели</a>
        `);
    } catch (error) {
        console.error('Error saving to database:', error);
        logger.error(`Database error: ${error.message}`);
        res.status(500).redirect('/Server-error');
    }
});

app.post('/delete-data', limiter, csrfProtection, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !validator.isEmail(email)) {
            return res.status(400).send('Некорректный email');
        }

        const connection = await mysql.createConnection(dbConfig);
        
        const [users] = await connection.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            await connection.end();
            return res.status(404).send('Пользователь не найден.');
        }
        const userId = users[0].id;

        // Здесь можно физически удалить данные или пометить как удалённые
        await connection.execute('DELETE FROM user_data WHERE user_id = ?', [userId]);
        
        // Логируем
        await connection.execute(
            `INSERT INTO event_logs (user_email, action, details, ip_address, user_agent)
             VALUES (?, 'data_deleted', 'Персональные данные удалены', ?, ?)`,
            [email, getClientIp(req), req.headers['user-agent']]
        );

        await connection.end();

        res.send(`
            <h3>Данные удалены</h3>
            <p>Ваши персональные данные удалены из системы. Ваши права на забвение реализованы (ст. 21 ФЗ-152).</p>
            <a href="/ER">Вернуться к модели</a>
        `);
    } catch (error) {
        console.error('Error saving to database:', error);
        logger.error(`Database error: ${error.message}`);
        res.status(500).redirect('/Server-error');
    }
});

app.get('/export-data', limiter, csrfProtection, async (req, res) => {
    try {
        const email = req.query.email;
        if (!email || !validator.isEmail(email)) {
            return res.status(400).send('Некорректный email');
        }

        const connection = await mysql.createConnection(dbConfig);
        
        const [users] = await connection.execute('SELECT id, name, email, created_at FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            await connection.end();
            return res.status(404).send('Пользователь не найден.');
        }
        const user = users[0];

        // Получаем пользовательские данные из таблицы user_data
        const [dataRows] = await connection.execute('SELECT field_name, field_value FROM user_data WHERE user_id = ?', [user.id]);
        
        // Также получаем историю согласий (для полноты)
        const [consents] = await connection.execute(
            'SELECT purpose, is_active, given_at, revoked_at FROM consents WHERE user_id = ?',
            [user.id]
        );

        // Формируем JSON
        const exportData = {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                registered_at: user.created_at
            },
            custom_fields: dataRows,
            consents_history: consents,
            export_date: new Date().toISOString(),
            legal_notice: 'Данные предоставлены в соответствии со ст. 14 ФЗ-152 "О персональных данных"'
        };

        await connection.execute(
            `INSERT INTO event_logs (user_email, action, details, ip_address, user_agent)
             VALUES (?, 'data_exported', 'Скачана копия ПДн', ?, ?)`,
            [email, getClientIp(req), req.headers['user-agent']]
        );
        await connection.end();

        res.setHeader('Content-disposition', `attachment; filename=personal_data_${email}.json`);
        res.setHeader('Content-type', 'application/json');
        res.send(JSON.stringify(exportData, null, 2));
    } catch (error) {
        console.error('Error saving to database:', error);
        logger.error(`Database error: ${error.message}`);
        res.status(500).redirect('/Server-error');
    }
});

// Thank you route
app.get('/thank-you', (req, res) => {
    res.render('thank-you', { title: 'Спасибо за ваш отзыв!', redirectUrl: '/' });
});

app.get('/Server-error', (req, res) => {
    res.status(500).render('500', {title: "Внутренняя ошибка сервера"})
})

// CSRF error handling
app.use(function (err, req, res, next) {
    if (err.code !== 'EBADCSRFTOKEN') return next(err)

    // handle CSRF token errors here
    res.status(403)
    res.send('Form tampered with')
});

// Middleware for logging requests
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", '*'); // Разрешить запросы со всех доменов (не рекомендуется для production)
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Middleware for 404 errors
app.use((req, res, next) => {
    res.status(404).render('404', { title: 'Страница не найдена' });
});

// const start = () => { ... } // старую функцию замените на эту:

const start = () => {
    try {
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`✅ HTTP Server started on: http://localhost:${PORT}`);
            console.log(`Process PID: ${process.pid}`);
            logger.info('server start');
        });
    } catch (e) {
        logger.error(`Server error: ${e.message}`);
        logger.error(e.stack);
        console.error(e);
    }
};

// Тесты
//if (require.main === module) {
    start();
//}
//module.exports = app;