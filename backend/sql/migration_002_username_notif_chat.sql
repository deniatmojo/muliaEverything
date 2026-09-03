-- Migration 002: username, notifikasi, catatan SO + mention, chat DM
-- Jalankan: mysql -u root -p mulia_everything < sql/migration_002_username_notif_chat.sql
USE mulia_everything;

-- ==============================
-- 1. USERNAME (login bisa username ATAU email)
-- ==============================
ALTER TABLE users
  ADD COLUMN username VARCHAR(50) DEFAULT NULL AFTER email,
  ADD UNIQUE INDEX idx_users_username (username);

-- ==============================
-- 2. NOTIFIKASI (lonceng)
-- ==============================
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,            -- penerima notifikasi
  actor_id VARCHAR(64) DEFAULT NULL,       -- pelaku aksi
  type VARCHAR(50) NOT NULL,               -- contoh: ACTIVITY, SO_NOTE, SO_CHAT, MENTION
  title VARCHAR(200) NOT NULL,
  message VARCHAR(500) DEFAULT NULL,
  link VARCHAR(300) DEFAULT NULL,          -- URL tujuan saat notifikasi diklik
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notif_user (user_id, is_read),
  INDEX idx_notif_created (created_at)
) ENGINE=InnoDB;

-- ==============================
-- 3. CATATAN SO + MENTION (card catatan di Dashboard SO)
-- ==============================
CREATE TABLE IF NOT EXISTS so_notes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  so_id VARCHAR(64) NOT NULL,              -- nomor SO, mis. SO-2026-0789
  user_id VARCHAR(64) NOT NULL,            -- pembuat catatan
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notes_so (so_id),
  INDEX idx_notes_user (user_id)
) ENGINE=InnoDB;

-- ==============================
-- 4. CHAT DI DETAIL SO (komentar per SO)
-- ==============================
CREATE TABLE IF NOT EXISTS so_chat_messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  so_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,            -- pengirim
  content TEXT NOT NULL,
  attachment_path VARCHAR(500) DEFAULT NULL,
  attachment_name VARCHAR(200) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_soc_so (so_id),
  INDEX idx_soc_user (user_id)
) ENGINE=InnoDB;

-- ==============================
-- 5. CHAT PRIBADI ANTAR PENGGUNA (bubble pojok kanan bawah)
-- ==============================
CREATE TABLE IF NOT EXISTS conversations (
  id VARCHAR(64) PRIMARY KEY,
  user1_id VARCHAR(64) NOT NULL,           -- selalu id yang lebih kecil (urutan alfabetis)
  user2_id VARCHAR(64) NOT NULL,
  last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX idx_conv_pair (user1_id, user2_id),
  INDEX idx_conv_u1 (user1_id),
  INDEX idx_conv_u2 (user2_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  conversation_id VARCHAR(64) NOT NULL,
  sender_id VARCHAR(64) NOT NULL,
  content TEXT DEFAULT NULL,
  attachment_path VARCHAR(500) DEFAULT NULL,  -- file di backend/uploads/chat/
  attachment_name VARCHAR(200) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_msg_conv (conversation_id, id)
) ENGINE=InnoDB;

-- Penanda pesan sudah dibaca oleh penerima
CREATE TABLE IF NOT EXISTS chat_message_reads (
  message_id BIGINT NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id, user_id),
  INDEX idx_cmr_user (user_id)
) ENGINE=InnoDB;
