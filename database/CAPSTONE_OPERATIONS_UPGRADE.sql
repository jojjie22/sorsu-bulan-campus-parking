-- Import AFTER campus_parking.sql, ADMS_advanced_features.sql and QR_SECURITY_UPGRADE.sql.
-- Preserves existing users, visits, permits, and audit records.
-- Back up before applying. MySQL 8 / XAMPP MariaDB 10.4+.
USE campus_parking;

CREATE TABLE IF NOT EXISTS gate_queue_arrivals (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  guard_id INT UNSIGNED NOT NULL,
  gate_label VARCHAR(40) NOT NULL DEFAULT 'Main Gate',
  arrived_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at DATETIME(3) NULL,
  FOREIGN KEY (guard_id) REFERENCES users(id),
  INDEX ix_gate_queue_date(arrived_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gate_processing_metrics (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  guard_id INT UNSIGNED NOT NULL,
  queue_arrival_id BIGINT UNSIGNED NULL,
  permit_id INT UNSIGNED NULL,
  plate_number VARCHAR(20) NULL,
  gate_label VARCHAR(40) NOT NULL DEFAULT 'Main Gate',
  phase ENUM('verification','transaction') NOT NULL,
  outcome ENUM('verified','entry','exit','denied') NOT NULL,
  reason VARCHAR(160) NULL,
  server_duration_ms INT UNSIGNED NOT NULL,
  client_scan_ms INT UNSIGNED NULL,
  client_confirm_ms INT UNSIGNED NULL,
  wait_ms INT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (guard_id) REFERENCES users(id),
  FOREIGN KEY (permit_id) REFERENCES permits(id),
  FOREIGN KEY (queue_arrival_id) REFERENCES gate_queue_arrivals(id),
  INDEX ix_gate_metrics_time(created_at),
  INDEX ix_gate_metrics_gate(gate_label,created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS parking_inspections (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slot_id INT UNSIGNED NOT NULL,
  guard_id INT UNSIGNED NOT NULL,
  observed_status ENUM('occupied','empty') NOT NULL,
  observed_plate VARCHAR(20) NULL,
  notes VARCHAR(500) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (slot_id) REFERENCES parking_slots(id),
  FOREIGN KEY (guard_id) REFERENCES users(id),
  INDEX ix_inspection_slot_date(slot_id,created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS parking_reconciliation_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  inspection_id BIGINT UNSIGNED NOT NULL,
  slot_id INT UNSIGNED NOT NULL,
  action ENUM('close_missing_exit','open_missing_entry') NOT NULL,
  visit_id BIGINT UNSIGNED NULL,
  permit_id INT UNSIGNED NULL,
  observed_plate VARCHAR(20) NULL,
  reason VARCHAR(500) NOT NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  requested_by INT UNSIGNED NOT NULL,
  reviewed_by INT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  resolution VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inspection_id) REFERENCES parking_inspections(id),
  FOREIGN KEY (slot_id) REFERENCES parking_slots(id),
  FOREIGN KEY (visit_id) REFERENCES parking_visits(id),
  FOREIGN KEY (permit_id) REFERENCES permits(id),
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id),
  INDEX ix_reconciliation_status(status,created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS parking_area_policies (
  area_id INT UNSIGNED PRIMARY KEY,
  allocation_priority SMALLINT NOT NULL DEFAULT 50,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (area_id) REFERENCES parking_areas(id)
) ENGINE=InnoDB;
INSERT IGNORE INTO parking_area_policies(area_id)
SELECT id FROM parking_areas;

CREATE TABLE IF NOT EXISTS user_parking_preferences (
  user_id INT UNSIGNED PRIMARY KEY,
  preferred_area_id INT UNSIGNED NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (preferred_area_id) REFERENCES parking_areas(id)
) ENGINE=InnoDB;

CREATE OR REPLACE VIEW vw_latest_parking_inspections AS
SELECT i.id,i.slot_id,i.guard_id,i.observed_status,i.observed_plate,i.notes,i.created_at,
       s.code,a.name AS area,v.id AS recorded_visit_id,v.plate_number AS recorded_plate,
       CASE WHEN v.id IS NULL THEN 'empty' ELSE 'occupied' END AS recorded_status,
       CASE WHEN (i.observed_status='empty' AND v.id IS NOT NULL)
                  OR (i.observed_status='occupied' AND v.id IS NULL)
                  OR (i.observed_status='occupied' AND v.id IS NOT NULL AND
                      REPLACE(UPPER(COALESCE(i.observed_plate,'')),' ','') <> REPLACE(UPPER(v.plate_number),' ',''))
            THEN 1 ELSE 0 END AS mismatch
FROM parking_inspections i
JOIN parking_slots s ON s.id=i.slot_id
JOIN parking_areas a ON a.id=s.area_id
LEFT JOIN parking_visits v ON v.slot_id=s.id AND v.exit_at IS NULL
WHERE i.id=(SELECT MAX(i2.id) FROM parking_inspections i2 WHERE i2.slot_id=i.slot_id);

CREATE OR REPLACE VIEW vw_gate_hourly_traffic AS
SELECT DATE(created_at) AS day,HOUR(created_at) AS hour_of_day,gate_label,
       COUNT(*) AS attempts,
       SUM(outcome='entry') AS entries,
       SUM(outcome='exit') AS exits,
       SUM(outcome='denied') AS denied,
       ROUND(AVG(CASE WHEN outcome IN ('entry','exit') THEN client_confirm_ms END)) AS avg_confirmation_ms,
       ROUND(AVG(wait_ms)) AS avg_wait_ms
FROM gate_processing_metrics
WHERE phase='transaction'
GROUP BY DATE(created_at),HOUR(created_at),gate_label;
