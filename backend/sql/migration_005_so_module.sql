-- Migration 005: Modul SO lengkap (master, versi BOQ, material, frame, approval, kamus material)
-- Jalankan: mysql -u root -p mulia_everything < sql/migration_005_so_module.sql
USE mulia_everything;

-- ==============================
-- 1. MASTER SO
-- ==============================
CREATE TABLE IF NOT EXISTS so (
  id VARCHAR(64) PRIMARY KEY,                      -- nomor SO, mis. SO-2026-0341
  project_number VARCHAR(64) DEFAULT NULL,         -- dari engineering saat tender, mis. 26-0341
  customer VARCHAR(150) DEFAULT NULL,
  project_name VARCHAR(200) DEFAULT NULL,
  company VARCHAR(150) DEFAULT NULL,               -- nama PT
  sales_name VARCHAR(150) DEFAULT NULL,
  address VARCHAR(500) DEFAULT NULL,
  pallet_count INT DEFAULT NULL,                   -- angka murni dari sheet CONSOLIDATED
  budget_idr BIGINT DEFAULT 0,                     -- lokal IDR + import RMB x kurs (dihitung ulang saat versi aktif)
  kurs DOUBLE DEFAULT NULL,                        -- kurs RMB->IDR saat versi aktif di-approve
  kurs_date DATETIME DEFAULT NULL,
  start_production DATE DEFAULT NULL,
  first_delivery DATE DEFAULT NULL,
  start_installation DATE DEFAULT NULL,
  target_installation DATE DEFAULT NULL,
  description TEXT DEFAULT NULL,
  status ENUM('draft','active') NOT NULL DEFAULT 'draft',
  stage ENUM('produksi','pengiriman','instalasi','completed') NOT NULL DEFAULT 'produksi',
  progress TINYINT DEFAULT 0,
  active_version_id BIGINT DEFAULT NULL,           -- versi material yang sedang aktif
  has_pending_change TINYINT(1) NOT NULL DEFAULT 0,-- ada change request menunggu approval (kunci Edit & Upload)
  created_by VARCHAR(64) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_so_status (status),
  CONSTRAINT fk_so_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ==============================
-- 2. VERSI BOQ (hasil upload excel / revisi manual yang di-approve)
-- ==============================
CREATE TABLE IF NOT EXISTS so_versions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  so_id VARCHAR(64) NOT NULL,
  version_no INT NOT NULL DEFAULT 1,               -- 6 => "V.6"
  source ENUM('excel','manual','initial') NOT NULL DEFAULT 'excel',
  file_path VARCHAR(500) DEFAULT NULL,             -- file excel asli (jika dari upload)
  file_name VARCHAR(300) DEFAULT NULL,
  kurs DOUBLE DEFAULT NULL,
  kurs_date DATETIME DEFAULT NULL,
  total_weight DOUBLE DEFAULT 0,
  total_import_rmb DOUBLE DEFAULT 0,
  total_lokal_idr BIGINT DEFAULT 0,
  pallet_count INT DEFAULT NULL,
  status ENUM('pending','active','discarded','rejected','superseded') NOT NULL DEFAULT 'pending',
  created_by VARCHAR(64) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_at DATETIME DEFAULT NULL,
  approved_by VARCHAR(64) DEFAULT NULL,
  INDEX idx_ver_so (so_id, version_no),
  CONSTRAINT fk_ver_so FOREIGN KEY (so_id) REFERENCES so (id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==============================
-- 3. MATERIAL PER VERSI (baris BOQ, import RMB / lokal IDR)
-- ==============================
CREATE TABLE IF NOT EXISTS so_materials (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  version_id BIGINT NOT NULL,
  so_id VARCHAR(64) NOT NULL,
  sheet VARCHAR(100) DEFAULT NULL,                 -- BOQ-Standard Items, dst
  article_code VARCHAR(64) NOT NULL,
  description VARCHAR(500) DEFAULT NULL,
  dim1 VARCHAR(50) DEFAULT NULL,
  dim2 VARCHAR(50) DEFAULT NULL,
  colour VARCHAR(50) DEFAULT NULL,
  ral VARCHAR(50) DEFAULT NULL,
  qty DOUBLE NOT NULL DEFAULT 0,
  unit_weight DOUBLE DEFAULT 0,
  unit_price DOUBLE DEFAULT 0,
  currency ENUM('RMB','IDR') NOT NULL DEFAULT 'RMB',
  notes VARCHAR(200) DEFAULT NULL,
  INDEX idx_mat_ver (version_id),
  INDEX idx_mat_so (so_id),
  CONSTRAINT fk_mat_ver FOREIGN KEY (version_id) REFERENCES so_versions (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==============================
-- 4. FRAME (MPF) PER VERSI — bukan material, informasi jumlah frame
-- ==============================
CREATE TABLE IF NOT EXISTS so_frames (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  version_id BIGINT NOT NULL,
  so_id VARCHAR(64) NOT NULL,
  article_code VARCHAR(64) NOT NULL,
  dim1 VARCHAR(50) DEFAULT NULL,
  dim2 VARCHAR(50) DEFAULT NULL,
  qty DOUBLE NOT NULL DEFAULT 0,
  description VARCHAR(500) DEFAULT NULL,
  INDEX idx_frm_ver (version_id),
  CONSTRAINT fk_frm_ver FOREIGN KEY (version_id) REFERENCES so_versions (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==============================
-- 5. PERMINTAAN PERUBAHAN (approval queue untuk Developer)
-- ==============================
CREATE TABLE IF NOT EXISTS so_change_requests (
  id VARCHAR(64) PRIMARY KEY,
  so_id VARCHAR(64) NOT NULL,
  type ENUM('excel','manual') NOT NULL,
  status ENUM('pending','approved','rejected','discarded') NOT NULL DEFAULT 'pending',
  draft_version_id BIGINT DEFAULT NULL,            -- versi draft excel hasil parse (type=excel)
  payload JSON DEFAULT NULL,                       -- state hasil edit manual: { form, materials, frames } (type=manual)
  diff JSON DEFAULT NULL,                          -- ringkasan diff vs data aktif (dihitung server)
  impact JSON DEFAULT NULL,                        -- { pallet, berat, importRMB, lokalIDR, budget } before/after
  requester_id VARCHAR(64) NOT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confirmed_at DATETIME DEFAULT NULL,                     -- diisi saat pengaju benar-benar mengirim untuk approval (setelah preview)
  decided_at DATETIME DEFAULT NULL,
  decided_by VARCHAR(64) DEFAULT NULL,
  reject_reason VARCHAR(500) DEFAULT NULL,
  INDEX idx_cr_so (so_id, status),
  INDEX idx_cr_status (status),
  CONSTRAINT fk_cr_so FOREIGN KEY (so_id) REFERENCES so (id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==============================
-- 6. KAMUS MATERIAL (terisi otomatis dari BOQ: article code + deskripsi unik)
-- ==============================
CREATE TABLE IF NOT EXISTS materials (
  article_code VARCHAR(64) PRIMARY KEY,
  description VARCHAR(500) DEFAULT NULL,
  first_seen_so VARCHAR(64) DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
