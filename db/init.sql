-- Определение кодировки
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- Таблица отзывов
CREATE TABLE IF NOT EXISTS reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date_time DATETIME NOT NULL,
    liked_website VARCHAR(255),
    favorite_section VARCHAR(255),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
)ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица логов событий
CREATE TABLE IF NOT EXISTS event_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица пользовательских данных (для экспорта)
CREATE TABLE IF NOT EXISTS user_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    field_name VARCHAR(100),
    field_value TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Демо-пользователь (для тестирования)
INSERT IGNORE INTO users (email, name) VALUES ('demo@example.com', 'Демо Пользователь');
INSERT IGNORE INTO user_data (user_id, field_name, field_value)
SELECT id, 'phone', '+7 999 123-45-67' FROM users WHERE email = 'demo@example.com';
INSERT IGNORE INTO consents (user_id, purpose, version, is_active)
SELECT id, 'регистрация', 'v1.0', TRUE FROM users WHERE email = 'demo@example.com';