-- Migration 003: Modul QC Traceability (generate barcode/QR + scan publik)
-- Jalankan: mysql -u root -p mulia_everything < sql/migration_003_qc.sql
USE mulia_everything;

CREATE TABLE IF NOT EXISTS qc_items (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,            -- kode unik untuk QR, mis. QC-260903-A1B2
  type ENUM('bundle', 'coil', 'packaging') NOT NULL,
  data JSON NOT NULL,                          -- field dinamis per tipe (customer, SO, no coil, dll.)
  pin_hash VARCHAR(100) NOT NULL,              -- PIN di-hash bcrypt, diverifikasi server
  status_item VARCHAR(30) NOT NULL DEFAULT 'In Checking',   -- Ready to Use | In Checking | Reject | Stock
  qc_process VARCHAR(30) NOT NULL DEFAULT 'Unchecking',     -- Unchecking | Passes
  inspector VARCHAR(150) DEFAULT NULL,
  scan_updated_at DATETIME DEFAULT NULL,       -- terisi = sudah diupdate via halaman scan (terkunci permanen)
  scan_updated_by VARCHAR(150) DEFAULT NULL,
  created_by VARCHAR(64) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_qc_type (type),
  INDEX idx_qc_created (created_at)
) ENGINE=InnoDB;
