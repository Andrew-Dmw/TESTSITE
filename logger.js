const config = require('./config');
const fs = require('fs');
const path = require('path');
const winston = require('winston');

module.exports = class Logger {
    constructor({
        logDir = path.join(__dirname, 'logs'), // Папка для хранения логов
        level = 'info',                     // Уровень логирования (info, warn, error и т.д.)
        conf = config.nodeEnv
    }) {
        this.logDir = logDir;
        this.level = level;
        this.logger = null;  // Инициализирует logger как null
        this.conf = conf;
        this._prepareDirs();   // Создаёт папку для логов, если её нет
        this._createLogger();  // Создаёт экземпляр Winston logger
    }

    // Создаёт папку для логов, если она не существует
    _prepareDirs() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    // Создаёт экземпляр Winston logger
    _createLogger() {
        this.logger = winston.createLogger({
            level: this.level,
            format: winston.format.combine(
                winston.format.timestamp({
                    format: 'YYYY-MM-DD HH:mm:ss'
                }),
                winston.format.errors({ stack: true }),
                winston.format.splat(),
                winston.format.json()
            ),
            defaultMeta: { service: 'web-application' },
            transports: [
                new winston.transports.File({ filename: path.join(this.logDir, 'error.log'), level: 'error' }),
                new winston.transports.File({ filename: path.join(this.logDir, 'combined.log') }),
            ],
        });

        // Если не production, то логирует также и в консоль
        if (this.conf !== 'production') {
            this.logger.add(new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.simple()
                )
            }));
        }
    }

    // Методы для логирования
    log(level, message) {
        if (this.logger) {
            this.logger.log(level, message);
        } else {
            console.warn('Logger not initialized. Log message:', level, message);
        }
    }

    info(message) {
        this.log('info', message);
    }

    warn(message) {
        this.log('warn', message);
    }

    error(message) {
        this.log('error', message);
    }
}
