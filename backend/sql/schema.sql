-- Skema database Mulia Everything (MySQL 8.x)
-- Jalankan: mysql -u root -p < sql/schema.sql

CREATE DATABASE IF NOT EXISTS mulia_everything
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mulia_everything;

CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(64) PRIMARY KEY,
  nama_role VARCHAR(100) NOT NULL UNIQUE,
  akses_menu JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  nama VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role VARCHAR(100) DEFAULT NULL,
  status ENUM('pending','approved','active') NOT NULL DEFAULT 'pending',
  verify_token VARCHAR(128) DEFAULT NULL,
  token_expires DATETIME DEFAULT NULL,
  position VARCHAR(150) DEFAULT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  avatar_url VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role) REFERENCES roles (nama_role)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) DEFAULT NULL,
  action_type VARCHAR(50) NOT NULL,
  description TEXT,
  status VARCHAR(30) DEFAULT 'Sukses',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_logs_user (user_id),
  INDEX idx_logs_created (created_at)
) ENGINE=InnoDB;

-- Seed role Developer
INSERT INTO roles (id, nama_role, akses_menu) VALUES
  ('r-1', 'Developer', JSON_ARRAY('/', '/developer', '/pengaturan', '/so'))
ON DUPLICATE KEY UPDATE akses_menu = VALUES(akses_menu);
