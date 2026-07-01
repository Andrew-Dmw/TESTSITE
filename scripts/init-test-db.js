const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

(async () => {
    // Параметры подключения к серверу MySQL (без указания конкретной базы)
    const serverConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
    };

    // Имя тестовой базы данных
    const testDbName = process.env.DB_DATABASE || 'my_diploma_test_db';

    let connection;
    try {
        // 1. Подключаемся к серверу MySQL без указания базы
        connection = await mysql.createConnection(serverConfig);
        console.log('✅ Connected to MySQL server');

        // 2. Создаём базу данных, если её нет
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${testDbName}\``);
        console.log(`📦 Database '${testDbName}' ensured`);

        // 3. Переключаемся на созданную/существующую базу
        await connection.query(`USE \`${testDbName}\``);

        // 4. Читаем SQL-скрипт инициализации
        // Используем абсолютный путь от корня проекта (где находится package.json)
        const initSqlPath = path.resolve(process.cwd(), 'db', 'init.sql');
        if (!fs.existsSync(initSqlPath)) {
            throw new Error(`SQL file not found: ${initSqlPath}`);
        }
        const sql = fs.readFileSync(initSqlPath, 'utf8');

        // 5. Выполняем SQL-команды
        // Разбиваем скрипт на отдельные запросы, чтобы избежать multipleStatements
        const queries = sql
            .split(';')
            .map(q => q.trim())
            .filter(q => q.length > 0);

        for (const query of queries) {
            await connection.query(query);
        }

        console.log('✅ Test database initialized successfully');
    } catch (err) {
        console.error('❌ Failed to init test DB:', err.message);
        process.exit(1);
    } finally {
        // 6. Закрываем соединение в любом случае
        if (connection) {
            await connection.end();
        }
    }
})();