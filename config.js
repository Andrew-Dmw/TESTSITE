// config.js
const crypto = require('crypto');
require('dotenv').config({ debug: false });   // ← было debug: true

const config = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3000,
    hostname: process.env.HOSTNAME || 'localhost',

    db: {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || 'my_diploma_db',
    },

    sessionSecret: process.env.SESSION_SECRET,
    pepper: process.env.PASSWORD_PEPPER,
};

// Валидация обязательных переменных
const required = {
    production: ['sessionSecret', 'pepper'],
    development: [],
};

const mustHave = required[config.nodeEnv] || required.production;
const missing = mustHave.filter(k => !config[k]);
if (missing.length > 0) {
    console.error(`❌ Отсутствуют обязательные переменные: ${missing.join(', ')}`);
    process.exit(1);
}

// В dev: если не заданы — генерируем эфемерные (случайные при каждом старте)
if (!config.sessionSecret) {
    config.sessionSecret = crypto.randomBytes(32).toString('hex');
    console.warn('⚠️ SESSION_SECRET не задан — сгенерирован случайный для этой сессии');
}
if (!config.pepper) {
    config.pepper = crypto.randomBytes(32).toString('hex');
    console.warn('⚠️ PASSWORD_PEPPER не задан — сгенерирован случайный');
}

// Минимальная длина секретов
if (config.sessionSecret && config.sessionSecret.length < 32) {
    console.error('❌ SESSION_SECRET слишком короткий (минимум 32 символа)');
    process.exit(1);
}
if (config.pepper && config.pepper.length < 32) {
    console.error('❌ PASSWORD_PEPPER слишком короткий (минимум 32 символа)');
    process.exit(1);
}

if (isNaN(config.port)) {
    console.error('❌ PORT должен быть числом');
    process.exit(1);
}

module.exports = config;