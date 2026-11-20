-- Campus Parking Management System - import into phpMyAdmin
CREATE DATABASE IF NOT EXISTS campus_parking CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE campus_parking;
CREATE TABLE IF NOT EXISTS users (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 full_name VARCHAR(140) NOT NULL,
 email VARCHAR(190) NOT NULL UNIQUE,
 student_employee_id VARCHAR(60) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 role ENUM('admin','guard','student','faculty') NOT NULL DEFAULT 'student',
 active TINYINT(1) NOT NULL DEFAULT 1,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS auth_tokens (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_id INT UNSIGNED NOT NULL,
 token_hash CHAR(64) NOT NULL UNIQUE,
 expires_at DATETIME NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS parking_areas (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS parking_slots (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 area_id INT UNSIGNED NOT NULL,
 code VARCHAR(30) NOT NULL,
 vehicle_type ENUM('car','motorcycle','any') NOT NULL DEFAULT 'any',
 status ENUM('active','unavailable') NOT NULL DEFAULT 'active',
 UNIQUE KEY unique_slot (area_id,code),
 FOREIGN KEY (area_id) REFERENCES parking_areas(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS vehicles (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_id INT UNSIGNED NOT NULL,
 plate_number VARCHAR(20) NOT NULL UNIQUE,
 vehicle_type ENUM('car','motorcycle') NOT NULL,
 brand VARCHAR(70) NOT NULL,
 model VARCHAR(70) NOT NULL,
 color VARCHAR(40) NOT NULL,
 ownership ENUM('owned','family','authorized') NOT NULL,
 verification_status ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
 reviewed_by INT UNSIGNED NULL,
 reviewed_at DATETIME NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (user_id) REFERENCES users(id),
 FOREIGN KEY (reviewed_by) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS permits (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 vehicle_id INT UNSIGNED NOT NULL,
 status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
 permit_code VARCHAR(35) NULL UNIQUE,
 qr_secret VARCHAR(48) NULL,
 issued_at DATE NULL,
 expires_at DATE NULL,
 reviewed_by INT UNSIGNED NULL,
 reviewed_at DATETIME NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
 FOREIGN KEY (reviewed_by) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS parking_visits (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 permit_id INT UNSIGNED NOT NULL,
 vehicle_id INT UNSIGNED NOT NULL,
 slot_id INT UNSIGNED NOT NULL,
 plate_number VARCHAR(20) NOT NULL,
 entry_guard_id INT UNSIGNED NOT NULL,
 exit_guard_id INT UNSIGNED NULL,
 entry_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 exit_at DATETIME NULL,
 -- MySQL/MariaDB unique keys allow multiple NULLs, but only one active visit per slot/vehicle.
 active_slot_id INT UNSIGNED GENERATED ALWAYS AS (CASE WHEN exit_at IS NULL THEN slot_id ELSE NULL END) STORED,
 active_vehicle_id INT UNSIGNED GENERATED ALWAYS AS (CASE WHEN exit_at IS NULL THEN vehicle_id ELSE NULL END) STORED,
 UNIQUE KEY unique_active_slot(active_slot_id),
 UNIQUE KEY unique_active_vehicle(active_vehicle_id),
 INDEX idx_entry_at(entry_at),
 FOREIGN KEY (permit_id) REFERENCES permits(id),
 FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
 FOREIGN KEY (slot_id) REFERENCES parking_slots(id),
 FOREIGN KEY (entry_guard_id) REFERENCES users(id),
 FOREIGN KEY (exit_guard_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS settings (
 `key` VARCHAR(80) PRIMARY KEY,
 value VARCHAR(200) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS audit_logs (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_id INT UNSIGNED NULL,
 action VARCHAR(100) NOT NULL,
 details VARCHAR(255) NOT NULL DEFAULT '',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;
INSERT IGNORE INTO parking_areas(id,name) VALUES (1,'North Parking'),(2,'Main Campus'),(3,'Faculty Parking');
INSERT IGNORE INTO settings(`key`,value) VALUES ('campus_name','Campus Parking'),('parking_hours','6:00 AM - 10:00 PM');
-- Initial slots are created by seed.php (safe to run repeatedly).
