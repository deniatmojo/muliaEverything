-- Migration 006: Modul Production (job per mesin, log output operator, QR token lapangan, buffer stock)
-- Jalankan: mysql -u root -p mulia_everything < sql/migration_006_production.sql
USE mulia_everything;

-- ==============================
-- 1. JOB PRODUKSI PER MESIN
-- Dibuat sekaligus untuk semua tahap pipeline material (roll/welding/painting)
-- dari material produksi (MPU/MPD/MPB lokal) versi BOQ aktif.
-- ==============================
CREATE TABLE IF NOT EXISTS production_jobs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  so_id VARCHAR(64) NOT NULL,
  version_id BIGINT NOT NULL,                      -- versi BOQ saat job dibuat
  material_id BIGINT DEFAULT NULL,                 -- baris so_materials asal (snapshot di bawah agar buffer stock tetap terbaca)
  machine ENUM('upright','bracing','beam','welding','painting') NOT NULL,
  article_code VARCHAR(64) NOT NULL,               -- snapshot dari so_materials
  dim1 VARCHAR(50) DEFAULT NULL,
  dim2 VARCHAR(50) DEFAULT NULL,
  colour VARCHAR(50) DEFAULT NULL,
  qty_target DOUBLE NOT NULL DEFAULT 0,
  qty_done DOUBLE NOT NULL DEFAULT 0,              -- cache penjumlahan production_output_logs
  status ENUM('queued','running','paused','done','buffered','cancelled') NOT NULL DEFAULT 'queued',
  started_at DATETIME DEFAULT NULL,
  finished_at DATETIME DEFAULT NULL,
  created_by VARCHAR(64) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_job_so_machine (so_id, machine),
  INDEX idx_job_status (status),
  CONSTRAINT fk_job_so FOREIGN KEY (so_id) REFERENCES so (id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_job_ver FOREIGN KEY (version_id) REFERENCES so_versions (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==============================
-- 2. LOG OUTPUT (satu baris per input operator; qty selalu BERTAMBAH)
-- ==============================
CREATE TABLE IF NOT EXISTS production_output_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  job_id BIGINT NOT NULL,
  qty DOUBLE NOT NULL,
  note VARCHAR(500) DEFAULT NULL,
  input_via ENUM('app','qr') NOT NULL DEFAULT 'app',
  qr_token_id VARCHAR(64) DEFAULT NULL,            -- jejak token jika input via halaman publik
  operator_nama VARCHAR(150) DEFAULT NULL,         -- nama operator (input via QR tanpa login)
  created_by VARCHAR(64) DEFAULT NULL,             -- user app (input via halaman admin)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_log_job (job_id),
  INDEX idx_log_time (created_at),
  CONSTRAINT fk_log_job FOREIGN KEY (job_id) REFERENCES production_jobs (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==============================
-- 3. TOKEN QR LAPANGAN (halaman update progress tanpa login)
-- ==============================
CREATE TABLE IF NOT EXISTS production_qr_tokens (
  id VARCHAR(64) PRIMARY KEY,
  so_id VARCHAR(64) NOT NULL,
  token VARCHAR(128) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,                    -- NULL tidak diizinkan: pakai tahun jauh untuk "selama produksi"
  revoked TINYINT(1) NOT NULL DEFAULT 0,
  created_by VARCHAR(64) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_qrt_so (so_id),
  CONSTRAINT fk_qrt_so FOREIGN KEY (so_id) REFERENCES so (id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==============================
-- 4. VIEW BUFFER STOCK
-- Job berstatus 'buffered' (hasil produksi yang tidak lagi terpakai karena BOQ berubah)
-- diagregasi per article|dim|colour, siap dialokasikan ke project lain kelak.
-- ==============================
CREATE OR REPLACE VIEW v_production_buffer_stock AS
SELECT
  so_id AS origin_so_id,
  article_code,
  dim1,
  dim2,
  colour,
  COUNT(*) AS jumlah_job,
  SUM(qty_done) AS qty_buffer
FROM production_jobs
WHERE status = 'buffered' AND qty_done > 0
GROUP BY so_id, article_code, dim1, dim2, colour;
