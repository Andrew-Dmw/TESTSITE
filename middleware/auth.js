const { logger } = require('../logger');

function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    res.status(401).json({ error: 'Необходима авторизация' });
}

function isAdmin(req, res, next) {
    if (req.session.userId && req.session.userRole === 'admin' && req.session.userEmail === process.env.ADMIN_EMAIL) {
        return next();
    }
    logger.warn(`Попытка доступа к админке без прав: ${req.session.userEmail || 'anon'}, IP: ${req.ip}`);
    res.status(403).send('Доступ запрещён');
}

function apiKeyAuth(req, res, next) {
    const key = req.headers['x-api-key'];
    if (!key || key !== process.env.API_KEY) {
        return res.status(403).json({ error: 'Неверный API-ключ' });
    }
    next();
}

module.exports = { isAuthenticated, isAdmin, apiKeyAuth };