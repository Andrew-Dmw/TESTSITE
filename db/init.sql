-- Определение кодировки
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
USE my_diploma_db; -- или my_diploma_test_db для тестов

-- Таблица отзывов
CREATE TABLE IF NOT EXISTS reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date_time DATETIME NOT NULL,
    liked_website VARCHAR(255),
    favorite_section VARCHAR(255),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица пользователей (добавлены поля для авторизации и согласия)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL DEFAULT '',
    privacy_consent_given BOOLEAN DEFAULT FALSE,
    privacy_consent_date TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица согласий
CREATE TABLE IF NOT EXISTS consents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    purpose VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    given_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица логов событий
CREATE TABLE IF NOT EXISTS event_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица пользовательских данных (для экспорта)
CREATE TABLE IF NOT EXISTS user_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    field_name VARCHAR(100),
    field_value TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица фидбека
CREATE TABLE IF NOT EXISTS feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    feedback TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Демо-пользователь (пароль: demo123!)
INSERT INTO users (email, name, password_hash, privacy_consent_given, privacy_consent_date) 
VALUES ('demo@example.com', 'Демо Пользователь', '$2b$10$o5xT.Tn6hXIuOg2VFXmcOOUeaQnU30afrJ/rDHYeBCLHN4.eOEUS2', TRUE, NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash);

-- Добавляем согласие
INSERT INTO consents (user_id, purpose, version, is_active, given_at, ip_address, user_agent)
SELECT id, 'регистрация', 'v1.0', TRUE, NOW(), '127.0.0.1', 'demo'
FROM users WHERE email = 'demo@example.com'
ON DUPLICATE KEY UPDATE purpose = VALUES(purpose);

-- Добавляем демо-данные (телефон)
INSERT INTO user_data (user_id, field_name, field_value)
SELECT id, 'phone', '+7 999 123-45-67'
FROM users WHERE email = 'demo@example.com'
ON DUPLICATE KEY UPDATE field_value = VALUES(field_value);