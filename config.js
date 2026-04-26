require('dotenv').config({ debug: true });

const config = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3000,
    HOSTNAME: process.env.HOSTNAME || 'localhost',
    db: {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || 'my_diploma_db',
    },
    sessionSecret: process.env.SESSION_SECRET || 'fallback_secret'
};
module.exports = config;