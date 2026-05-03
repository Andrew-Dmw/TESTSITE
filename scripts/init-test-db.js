const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

(async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'my_diploma_test_db',
  });
  const sql = fs.readFileSync(path.join(__dirname, '../db/init.sql'), 'utf8');
  await connection.query(sql);
  await connection.end();
  console.log('Test database initialized');
})();