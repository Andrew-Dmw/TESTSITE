const config = require('./config');
const fs = require('fs');
const path = require('path');
const winston = require('winston');

module.exports = class Logger {
    /**
     * @param {Object} options
     * @param {string} [options.logDir] – путь к папке с логами, по умолчанию './logs' рядом с этим файлом
     * @param {string} [options.level] – уровень логирования (error, warn, info, debug и т.д.), по умолчанию 'info'
     * @param {string} [options.nodeEnv] – окружение (production, development), по умолчанию из NODE_ENV или config
     * @param {string} [options.serviceName] – имя сервиса для defaultMeta, по умолчанию 'web-application'
     */
    constructor({
        logDir = path.join(__dirname, 'logs'),
        level = 'info',
        nodeEnv = config.nodeEnv || process.env.NODE_ENV || 'development',
        serviceName = 'web-application'
    } = {}) {
        this.logDir = logDir;
        this.level = level;
        this.nodeEnv = nodeEnv;
        this.serviceName = serviceName;
        this.logger = null;  // будет создан в _createLogger()

        this._prepareDirs();   // гарантируем существование папки
        this._createLogger();  // инициализируем экземпляр Winston
    }

    /**
     * Создаёт папку для логов, если её ещё нет.
     * Использует синхронные вызовы, потому что это происходит при старте приложения.
     * Ловим ошибку доступа к файловой системе, чтобы сразу понять проблему.
     */
    _prepareDirs() {
        try {
            if (!fs.existsSync(this.logDir)) {
                fs.mkdirSync(this.logDir, { recursive: true });
            }
        } catch (err) {
            // В случае ошибки выводим в консоль и пробрасываем дальше, так как без логов работа нежелательна
            console.error(`Не удалось создать папку для логов: ${this.logDir}`, err);
            throw err;
        }
    }

    /**
     * Конфигурирует Winston с двумя файловыми транспортами (error.log и combined.log)
     * и, если не production, добавляет консольный транспорт с цветным выводом.
     */
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
            defaultMeta: { service: this.serviceName },
            transports: [
                // Все ошибки – в отдельный файл
                new winston.transports.File({
                    filename: path.join(this.logDir, 'error.log'),
                    level: 'error'
                }),
                // Все логи – в общий файл
                new winston.transports.File({
                    filename: path.join(this.logDir, 'combined.log')
                }),
            ],
        });

        // В development/test окружении удобно видеть логи в консоли
        if (this.nodeEnv !== 'production') {
            this.logger.add(new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.simple()
                )
            }));
        }
    }

    /**
     * Универсальный метод для вызова любого уровня
     * @param {string} level – уровень (error, warn, info, debug и т.д.)
     * @param {string} message – сообщение
     */
    log(level, message) {
        if (this.logger) {
            this.logger.log(level, message);
        } else {
            console.warn('Логгер не инициализирован. Сообщение:', level, message);
        }
    }

    // Обёртки для типовых уровней, чтобы не писать 'info' каждый раз
    info(message) {
        this.log('info', message);
    }

    warn(message) {
        this.log('warn', message);
    }

    error(message) {
        this.log('error', message);
    }

    // Добавлен отсутствовавший метод debug, т.к. в приложении используется уровень debug
    debug(message) {
        this.log('debug', message);
    }
}