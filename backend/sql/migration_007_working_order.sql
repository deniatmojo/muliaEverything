-- Migration 007: Modul Working Order (WO) — unit eksekusi mesin pengganti job otomatis BOQ.
-- Tabel job lama (production_jobs dst.) dibiarkan sebagai histori, tidak dipakai lagi.
-- Jalankan: mysql -u root -p mulia_everything < sql/migration_007_working_order.sql
USE mulia_everything;

-- ==============================
-- 1. HEADER WORKING ORDER
-- ==============================
CREATE TABLE IF NOT EXISTS production_wo (
  id VARCHAR(64) PRIMARY KEY,                       -- WO-YYYYMMDD-001
  so_id VARCHAR(64) NOT NULL,
  project_code VARCHAR(64) DEFAULT NULL,            -- kode project (so.project_number) hasil pencarian
  customer VARCHAR(150) DEFAULT NULL,
  prepared_by VARCHAR(150) DEFAULT NULL,            -- nama (prefilled dari user login)
  created_by VARCHAR(64) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_wo_so (so_id),
  CONSTRAINT fk_wo_so FOREIGN KEY (so_id) REFERENCES so (id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==============================
-- 2. ITEM WO (baris tabel form + runtime antrean mesin)
-- ==============================
CREATE TABLE IF NOT EXISTS production_wo_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  wo_id VARCHAR(64) NOT NULL,
  so_id VARCHAR(64) NOT NULL,                       -- denormalisasi untuk pencocokan BOQ
  machine ENUM('upright','bracing','beam','welding','painting') NOT NULL,
  item VARCHAR(64) NOT NULL,                        -- article code, mis. MPD 1015
  length_mm VARCHAR(50) DEFAULT NULL,               -- dicocokkan ke so_materials.dim1 (string persis)
  qty_target DOUBLE NOT NULL DEFAULT 0,
  unit ENUM('Btg','Pcs','Kg') NOT NULL DEFAULT 'Btg',
  raw_material VARCHAR(150) DEFAULT NULL,
  multiplier_weight DOUBLE DEFAULT NULL,            -- berat total (kg), diisi admin
  req_galva TINYINT(1) NOT NULL DEFAULT 0,
  coil_number VARCHAR(100) DEFAULT NULL,
  qty_done DOUBLE NOT NULL DEFAULT 0,
  status ENUM('queued','running','paused','done','cancelled') NOT NULL DEFAULT 'queued',
  queue_order INT NOT NULL DEFAULT 0,               -- urutan antrean dalam mesin (drag-drop)
  started_at DATETIME DEFAULT NULL,
  finished_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_wi_queue (machine, status, queue_order),
  INDEX idx_wi_match (so_id, item, length_mm),
  CONSTRAINT fk_wi_wo FOREIGN KEY (wo_id) REFERENCES production_wo (id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==============================
-- 3. KODE AKSES MESIN (halaman operator tanpa login)
-- ==============================
CREATE TABLE IF NOT EXISTS production_machine_access (
  machine ENUM('upright','bracing','beam','welding','painting') PRIMARY KEY,
  code_hash VARCHAR(100) DEFAULT NULL,              -- bcrypt; NULL = kode belum disetel
  updated_by VARCHAR(64) DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ==============================
-- 4. LOG OUTPUT menunjuk item WO (kolom job_id lama dibiarkan, tidak dipakai lagi)
-- ==============================
ALTER TABLE production_output_logs
  ADD COLUMN wo_item_id BIGINT DEFAULT NULL AFTER job_id,
  ADD INDEX idx_log_wo (wo_item_id);

-- job_id (era job otomatis) kini tidak wajib lagi — output baru menunjuk item WO;
-- 'operator' = input dari halaman operator mesin (kode akses)
ALTER TABLE production_output_logs
  MODIFY COLUMN job_id BIGINT NULL,
  MODIFY COLUMN input_via ENUM('app','qr','operator') NOT NULL DEFAULT 'app';
