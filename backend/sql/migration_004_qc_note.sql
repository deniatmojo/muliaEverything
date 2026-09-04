-- Migration 004: catatan (note) inspeksi QC pada tabel qc_items
-- Jalankan: mysql -u root -p mulia_everything < sql/migration_004_qc_note.sql
USE mulia_everything;

ALTER TABLE qc_items
  ADD COLUMN note TEXT DEFAULT NULL AFTER inspector;
