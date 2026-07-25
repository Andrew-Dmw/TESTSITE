const config = require('./config');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// ============================================
// 1. Убеждаемся, что папка для логов существует
// ============================================
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
    console.log('📁 Папка logs создана');
}

// ============================================
// 2. Общий формат для всех логов
// ============================================
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// ============================================
// 3. Транспорты с ротацией и разделением по уровням
// ============================================
const transports = [
    // Только ошибки (храним 30 дней)
    new DailyRotateFile({
        filename: path.join(logDir, 'error-%DATE%.log'),
        level: 'error',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d'
    }),
    // Только предупреждения и выше (warn + error)
    new DailyRotateFile({
        filename: path.join(logDir, 'warn-%DATE%.log'),
        level: 'warn',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d'
    }),
    // Информационные (info + warn + error), без debug
    new DailyRotateFile({
        filename: path.join(logDir, 'info-%DATE%.log'),
        level: 'info',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d'
    }),
    // Все уровни (debug и выше) — храним 7 дней
    new DailyRotateFile({
        filename: path.join(logDir, 'debug-%DATE%.log'),
        level: 'debug',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '7d'
    }),
    // Опционально: всё в одной куче
    new DailyRotateFile({
        filename: path.join(logDir, 'combined-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d'
    })
];

// ============================================
// 4. Создаём корневой логгер
// ============================================
const logger = winston.createLogger({
    level: 'debug', // минимальный уровень, который обрабатываем
    format: logFormat,
    transports,
    // Добавляем дефолтные метаданные (можно переопределить в child)
    defaultMeta: { service: 'my-diploma' }
});

// ============================================
// 5. В режиме разработки — дублируем в консоль с цветами
// ============================================
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        ),
        level: 'debug'
    }));
}

// ============================================
// 6. Функция для создания дочернего логгера с requestId
// ============================================
function getLogger(requestId) {
    return logger.child({ requestId });
}

// ============================================
// 7. Экспортируем
// ============================================
module.exports = { logger, getLogger };