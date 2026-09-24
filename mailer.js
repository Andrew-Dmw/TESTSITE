// ================================================================
// Модуль отправки писем
// ================================================================

const nodemailer = require('nodemailer');

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const SMTP_ENABLED = !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
);

const transporter = SMTP_ENABLED
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '465', 10),
        secure: (process.env.SMTP_PORT || '465') === '465',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    })
    : null;

const FROM = process.env.SMTP_USER || 'noreply@example.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'dmitrievandreu.law@mail.ru';

/**
 * Обёртка для отправки. Если SMTP не настроен — просто логируем.
 */
async function sendMail({ to, subject, html, text }) {
    if (!SMTP_ENABLED) {
        console.log('\n──────── EMAIL (SMTP не настроен, письмо не отправлено) ────────');
        console.log(`Кому: ${to}`);
        console.log(`Тема: ${subject}`);
        console.log('─────────────────────────────────────────────────────────────────\n');
        return { skipped: true };
    }

    try {
        const info = await transporter.sendMail({
            from: `"Юрист в Усть-Куте" <${escapeHtml(FROM)}>`,
            to,
            subject,
            text,
            html,
        });
        return { ok: true, messageId: info.messageId };
    } catch (err) {
        console.error('Ошибка отправки письма:', err.message);
        return { ok: false, error: err.message };
    }
}

// ================================================================
// Приветственное письмо при регистрации
// ================================================================
async function sendWelcomeEmail({ name, email }) {
    const subject = 'Добро пожаловать на сайт «Юрист в Усть-Куте»';

    const text = `
Здравствуйте, ${escapeHtml(name)}!

Спасибо за регистрацию на сайте «Юрист в Усть-Куте».

Ваш аккаунт создан, теперь вы можете:
- оставлять заявки на юридические услуги;
- управлять своими персональными данными (152-ФЗ);
- просматривать образцы юридических документов.

Личный кабинет: ${escapeHtml(process.env.FRONTEND_URL || 'https://localhost')}/main

Если у вас возникнут вопросы — просто ответьте на это письмо.

С уважением,
Дмитриев Андрей Константинович
Юрист, г. Усть-Кут
+7 (924) 619-34-73
`;

    const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<style>
    body { font-family: Arial, sans-serif; background: #f1f5f9; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #0a1628 0%, #1e3a8a 100%); color: #fff; padding: 30px; text-align: center; border-bottom: 4px solid #c9a961; }
    .header h1 { margin: 0; font-size: 22px; }
    .header .icon { font-size: 32px; margin-bottom: 8px; }
    .content { padding: 30px; color: #334155; line-height: 1.6; font-size: 15px; }
    .content h2 { color: #0f172a; font-size: 18px; margin-top: 0; }
    .btn { display: inline-block; background: #1e3a8a; color: #ffffff !important; padding: 12px 26px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0; border: 2px solid #c9a961; }
    .list { padding-left: 20px; }
    .list li { margin-bottom: 6px; }
    .footer { background: #f8fafc; padding: 20px 30px; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0; text-align: center; }
    .footer a { color: #1e3a8a; text-decoration: none; }
</style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="icon">⚖</div>
            <h1>Юрист в Усть-Куте</h1>
        </div>
        <div class="content">
            <h2>Здравствуйте, ${escapeHtml(name)}!</h2>
            <p>Спасибо за регистрацию на сайте. Ваш аккаунт успешно создан.</p>
            <p><strong>Что теперь доступно:</strong></p>
            <ul class="list">
                <li>Оставлять заявки на юридические услуги</li>
                <li>Управлять персональными данными (152-ФЗ)</li>
                <li>Скачивать образцы юридических документов</li>
                <li>Работать с демонстрационной моделью защиты данных</li>
            </ul>
            <p style="text-align:center">
                <a href="${escapeHtml(process.env.FRONTEND_URL || 'https://localhost')}/main" class="btn">Перейти в личный кабинет</a>
            </p>
            <p>Если у вас возникнут вопросы — просто ответьте на это письмо.</p>
        </div>
        <div class="footer">
            <strong>Дмитриев Андрей Константинович</strong><br>
            Юрист, г. Усть-Кут<br>
            <a href="tel:+79246193473">+7 (924) 619-34-73</a> ·
            <a href="mailto:dmitrievandreu.law@mail.ru">dmitrievandreu.law@mail.ru</a>
        </div>
    </div>
</body>
</html>
`;

    return sendMail({ to: email, subject, text, html });
}

// ================================================================
// Уведомление администратору о новой заявке
// ================================================================
async function sendLeadNotification(lead) {
    const subject = `Новая заявка №${escapeHtml(lead.id)} с сайта`;

    const text = `
Новая заявка с сайта!

ID: ${escapeHtml(lead.id)}
Имя: ${escapeHtml(lead.name)}
Контакт: ${escapeHtml(lead.contact)}
Сообщение: ${escapeHtml(lead.message || '(не указано)')}
Источник: ${escapeHtml(lead.source || 'direct')}
IP: ${escapeHtml(lead.ip || '—')}
Время: ${escapeHtml(new Date().toLocaleString('ru-RU'))}

Открыть в админке: ${escapeHtml(process.env.FRONTEND_URL || 'https://localhost')}/admin/leads
`.trim();

    const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<style>
    body { font-family: Arial, sans-serif; background: #f1f5f9; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #0a1628 0%, #1e3a8a 100%); color: #fff; padding: 24px 30px; border-bottom: 4px solid #c9a961; }
    .header h1 { margin: 0; font-size: 18px; }
    .content { padding: 24px 30px; color: #334155; font-size: 15px; }
    .row { padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
    .row:last-child { border-bottom: none; }
    .label { color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 600; display: block; margin-bottom: 3px; }
    .value { color: #0f172a; font-size: 15px; }
    .btn { display: inline-block; background: #1e3a8a; color: #ffffff !important; padding: 11px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 18px; border: 2px solid #c9a961; }
</style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📥 Новая заявка №${escapeHtml(lead.id)}</h1>
        </div>
        <div class="content">
            <div class="row">
                <span class="label">Имя</span>
                <span class="value">${escapeHtml(lead.name)}</span>
            </div>
            <div class="row">
                <span class="label">Контакт</span>
                <span class="value">${escapeHtml(lead.contact)}</span>
            </div>
            <div class="row">
                <span class="label">Сообщение</span>
                <span class="value">${escapeHtml(lead.message || '(не указано)')}</span>
            </div>
            <div class="row">
                <span class="label">Источник</span>
                <span class="value">${escapeHtml(lead.source || 'direct')}</span>
            </div>
            <div class="row">
                <span class="label">IP</span>
                <span class="value">${escapeHtml(lead.ip || '—')}</span>
            </div>
            <div class="row">
                <span class="label">Время</span>
                <span class="value">${escapeHtml(new Date().toLocaleString('ru-RU'))}</span>
            </div>
            <p style="text-align:center">
                <a href="${escapeHtml(process.env.FRONTEND_URL || 'https://localhost')}/admin/leads" class="btn">Открыть в админке</a>
            </p>
        </div>
    </div>
</body>
</html>
`;

    return sendMail({ to: ADMIN_EMAIL, subject, text, html });
}

module.exports = {
    sendMail,
    sendWelcomeEmail,
    sendLeadNotification,
    SMTP_ENABLED,
};