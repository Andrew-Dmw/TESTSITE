SET NAMES utf8mb4;

-- 1. Убрать root@%
DROP USER IF EXISTS 'root'@'%';
FLUSH PRIVILEGES;

-- 2. password_hash без DEFAULT
ALTER TABLE users MODIFY password_hash VARCHAR(255) NOT NULL;

-- 3. Индексы на security_incident_logs
ALTER TABLE security_incident_logs
    ADD INDEX idx_inc_status (status),
    ADD INDEX idx_inc_detection (detection_time),
    ADD INDEX idx_inc_user_email (user_email);

-- 4. Индексы на event_logs
ALTER TABLE event_logs
    ADD INDEX idx_ev_user_email (user_email),
    ADD INDEX idx_ev_created (created_at);

-- 5. Проверка
SELECT user, host FROM mysql.user;
SHOW INDEX FROM security_incident_logs;