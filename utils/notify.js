const { logger } = require('../logger');

async function notifyDataLeak(email, ip, reason) {
    console.log(
        `\n
        🚨 [УТЕЧКА ПДн] Обнаружена подозрительная активность:
        👤 Пользователь: ${email}
        🌐 IP-адрес: ${ip}
        📝 Причина: ${reason}
        ⏰ Время: ${new Date().toISOString()}
    `);
    logger.warn(`Утечка персональных данных: ${email}, IP: ${ip}, причина: ${reason}`);
    // Здесь можно отправить письмо админу
}

module.exports = { notifyDataLeak };