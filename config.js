// Загружаем переменные из .env файла.
// В development включаем debug для диагностики, в production – без вывода.
require('dotenv').config({
    debug: process.env.NODE_ENV !== 'production'
});

/**
 * Конфигурация приложения.
 * Все значения берутся из переменных окружения, с fallback только для некритичных настроек.
 */
const config = {
    // Окружение: development, test, production
    nodeEnv: process.env.NODE_ENV || 'development',

    // Порт HTTP-сервера (по умолчанию 3000)
    port: parseInt(process.env.PORT, 10) || 3000,

    // Имя хоста (для ссылок, CORS и т.д.)
    hostname: process.env.HOSTNAME || 'localhost',

    // Настройки подключения к базе данных
    db: {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        // Пароль не должен иметь значения по умолчанию, но для локальной разработки можно разрешить пустой
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || 'my_diploma_db',
    },

    // Секрет для подписи сессионных cookie
    sessionSecret: process.env.SESSION_SECRET,

    // Пиппер (секретная добавка к паролю)
    pepper: process.env.PASSWORD_PEPPER,
};

// Проверка критических переменных.
// Если отсутствуют в production, приложение не должно стартовать.
const requiredInProduction = ['sessionSecret', 'pepper'];
if (config.nodeEnv === 'production') {
    const missing = requiredInProduction.filter(key => !config[key]);
    if (missing.length > 0) {
        console.error(
            `❌ Отсутствуют обязательные переменные окружения: ${missing.join(', ')}. Приложение остановлено.`
        );
        process.exit(1);
    }
} else {
    // В development/test просто предупреждаем, если чего-то нет (но не падаем)
    if (!config.sessionSecret) {
        console.warn('⚠️ SESSION_SECRET не задан. Используется небезопасный fallback (только для разработки).');
        config.sessionSecret = 'fallback_dev_secret_do_not_use_in_prod';
    }
    if (!config.pepper) {
        console.warn('⚠️ PASSWORD_PEPPER не задан. Хеширование паролей будет менее безопасным.');
        config.pepper = 'default_pepper_change_me';
    }
}

// Небольшая валидация порта – он должен быть числом
if (isNaN(config.port)) {
    console.error('❌ PORT должен быть числом.');
    process.exit(1);
}

module.exports = config;