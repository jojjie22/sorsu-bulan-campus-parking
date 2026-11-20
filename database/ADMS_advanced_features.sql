-- SorSU–Bulan Campus Park: Advanced Database Management Systems
-- Apply ONCE AFTER campus_parking.sql to an existing database via phpMyAdmin > Import.
-- Re-running replaces these named views/routines/triggers/event (it does NOT delete rows).
-- Compatible SQL is intended for MySQL 8.x / MariaDB 10.4+ on XAMPP.
-- Take a backup before importing any migration.
USE campus_parking;

-- Permit expiration is a separate terminal state. Existing permit data is retained.
ALTER TABLE permits
  MODIFY COLUMN status ENUM('pending','approved','rejected','expired')
  NOT NULL DEFAULT 'pending';

-- ===== 1. VIEWS: secure, read-only projections for dashboards and reports =====
CREATE OR REPLACE VIEW vw_parking_availability AS
SELECT s.id, s.area_id, a.name AS area, s.code, s.vehicle_type, s.status,
       CASE WHEN pv.id IS NULL THEN 'available' ELSE 'occupied' END AS availability,
       pv.id AS visit_id, pv.plate_number AS occupied_plate
FROM parking_slots s
JOIN parking_areas a ON a.id = s.area_id
LEFT JOIN parking_visits pv ON pv.slot_id = s.id AND pv.exit_at IS NULL;

CREATE OR REPLACE VIEW vw_parking_area_summary AS
SELECT a.id AS area_id, a.name,
       COUNT(s.id) AS total,
       COALESCE(SUM(CASE WHEN s.status = 'active' THEN 1 ELSE 0 END),0) AS active,
       COALESCE(SUM(CASE WHEN s.status = 'active' AND pv.id IS NOT NULL THEN 1 ELSE 0 END),0) AS occupied,
       COALESCE(SUM(CASE WHEN s.status = 'active' AND pv.id IS NULL THEN 1 ELSE 0 END),0) AS available
FROM parking_areas a
LEFT JOIN parking_slots s ON s.area_id = a.id
LEFT JOIN parking_visits pv ON pv.slot_id = s.id AND pv.exit_at IS NULL
GROUP BY a.id, a.name;

-- IMPORTANT: QR secrets are deliberately excluded from reporting views.
CREATE OR REPLACE VIEW vw_active_permits AS
SELECT p.id, p.vehicle_id, p.permit_code, p.issued_at, p.expires_at,
       v.plate_number, v.vehicle_type, u.full_name AS owner_name
FROM permits p
JOIN vehicles v ON v.id = p.vehicle_id
JOIN users u ON u.id = v.user_id
WHERE p.status = 'approved' AND p.expires_at >= CURDATE()
      AND v.verification_status = 'verified';

-- 'exits' means visits that started on that date and have since exited,
-- NOT the count of exits occurring on that calendar date.
CREATE OR REPLACE VIEW vw_daily_parking_activity AS
SELECT DATE(pv.entry_at) AS day, COUNT(*) AS entries,
       SUM(CASE WHEN pv.exit_at IS NOT NULL THEN 1 ELSE 0 END) AS exits
FROM parking_visits pv
GROUP BY DATE(pv.entry_at);

-- ===== 2. TRIGGERS: automatic audit history for critical database changes =====
-- These create DB-specific audit records alongside existing application logs.
DROP TRIGGER IF EXISTS trg_permit_status_audit;
DROP TRIGGER IF EXISTS trg_visit_entry_audit;
DROP TRIGGER IF EXISTS trg_visit_exit_audit;

DELIMITER $$
CREATE TRIGGER trg_permit_status_audit
AFTER UPDATE ON permits FOR EACH ROW
BEGIN
    IF NOT (OLD.status <=> NEW.status) THEN
        INSERT INTO audit_logs (user_id, action, details)
        VALUES (CASE WHEN NEW.status = 'expired' THEN NULL ELSE NEW.reviewed_by END, 'db.permit.status',
            CONCAT('permit=',NEW.id,'; ',OLD.status,' -> ',NEW.status));
    END IF;
END$$

CREATE TRIGGER trg_visit_entry_audit
AFTER INSERT ON parking_visits FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, action, details)
    VALUES (NEW.entry_guard_id, 'db.gate.entry',
       CONCAT('visit=',NEW.id,'; plate=',NEW.plate_number,'; slot=',NEW.slot_id));
END$$

CREATE TRIGGER trg_visit_exit_audit
AFTER UPDATE ON parking_visits FOR EACH ROW
BEGIN
    IF OLD.exit_at IS NULL AND NEW.exit_at IS NOT NULL THEN
        INSERT INTO audit_logs (user_id, action, details)
        VALUES (NEW.exit_guard_id, 'db.gate.exit',
            CONCAT('visit=',NEW.id,'; plate=',NEW.plate_number,'; slot=',NEW.slot_id));
    END IF;
END$$
DELIMITER ;

-- ===== 3. STORED PROCEDURES: reusable entry / exit operations =====
-- Procedures own the DML, while the PHP API retains authenticated role checks,
-- QR verification, transaction boundaries and lock ordering.
-- CALL is also suitable for an ADMS instructor's database demonstration.
DROP PROCEDURE IF EXISTS sp_record_parking_entry;
DROP PROCEDURE IF EXISTS sp_record_parking_exit;
DROP PROCEDURE IF EXISTS sp_expire_parking_permits;

DELIMITER $$
CREATE PROCEDURE sp_record_parking_entry(
    IN p_permit_id INT UNSIGNED,
    IN p_vehicle_id INT UNSIGNED,
    IN p_slot_id INT UNSIGNED,
    IN p_plate_number VARCHAR(20),
    IN p_guard_id INT UNSIGNED
)
BEGIN
    DECLARE v_permit_ok INT DEFAULT 0;
    DECLARE v_slot_ok INT DEFAULT 0;

    SELECT COUNT(*) INTO v_permit_ok
      FROM permits p JOIN vehicles v ON v.id = p.vehicle_id
      WHERE p.id = p_permit_id AND v.id = p_vehicle_id
        AND p.status = 'approved' AND p.expires_at >= CURDATE()
        AND v.verification_status = 'verified' AND v.plate_number = p_plate_number;
    IF v_permit_ok <> 1 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Permit or vehicle is not valid for entry';
    END IF;

    SELECT COUNT(*) INTO v_slot_ok
      FROM parking_slots s JOIN vehicles v ON v.id = p_vehicle_id
      WHERE s.id = p_slot_id AND s.status = 'active'
        AND (s.vehicle_type = 'any' OR s.vehicle_type = v.vehicle_type);
    IF v_slot_ok <> 1 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Parking slot is inactive or wrong vehicle type';
    END IF;

    IF EXISTS (SELECT 1 FROM parking_visits WHERE vehicle_id = p_vehicle_id AND exit_at IS NULL) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Vehicle is already parked';
    END IF;
    IF EXISTS (SELECT 1 FROM parking_visits WHERE slot_id = p_slot_id AND exit_at IS NULL) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Parking slot is occupied';
    END IF;

    -- Unique generated-column keys also block racing duplicate entries.
    INSERT INTO parking_visits (permit_id, vehicle_id, slot_id, plate_number, entry_guard_id)
    VALUES (p_permit_id, p_vehicle_id, p_slot_id, p_plate_number, p_guard_id);
END$$

CREATE PROCEDURE sp_record_parking_exit(
    IN p_vehicle_id INT UNSIGNED,
    IN p_guard_id INT UNSIGNED
)
BEGIN
    DECLARE v_visit_id BIGINT UNSIGNED DEFAULT NULL;
    SELECT MAX(id) INTO v_visit_id FROM parking_visits
      WHERE vehicle_id = p_vehicle_id AND exit_at IS NULL;
    IF v_visit_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No active parking visit for this vehicle';
    END IF;
    -- Exit must remain possible even if a permit expires while the car is parked.
    UPDATE parking_visits SET exit_at = NOW(), exit_guard_id = p_guard_id
    WHERE id = v_visit_id AND exit_at IS NULL;
    IF ROW_COUNT() <> 1 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Parking visit was already closed';
    END IF;
END$$

CREATE PROCEDURE sp_expire_parking_permits()
BEGIN
    -- Date-based expiration: a permit remains valid through expires_at.
    UPDATE permits SET status = 'expired'
    WHERE status = 'approved' AND expires_at < CURDATE();
END$$
DELIMITER ;

-- ===== 4. SCHEDULED EVENT: runs expiry maintenance once daily =====
-- EVENT scheduler must be enabled by an authorized MySQL/MariaDB administrator.
DROP EVENT IF EXISTS ev_expire_parking_permits;
CREATE EVENT ev_expire_parking_permits
ON SCHEDULE EVERY 1 DAY STARTS CURRENT_TIMESTAMP + INTERVAL 1 MINUTE
ON COMPLETION PRESERVE ENABLE
DO CALL sp_expire_parking_permits();

-- Idempotent initial cleanup: expire historical records immediately on install.
CALL sp_expire_parking_permits();
