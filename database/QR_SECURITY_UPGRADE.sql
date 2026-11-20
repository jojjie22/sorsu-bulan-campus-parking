-- SorSU Bulan Campus Park: secure one-time, 60-second QR credentials.
-- Import AFTER campus_parking.sql and ADMS_advanced_features.sql.
-- Non-destructive: creates only new tables. Back up the database first.
USE campus_parking;

CREATE TABLE IF NOT EXISTS qr_access_tokens (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    permit_id INT UNSIGNED NOT NULL,
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    used_by INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_qr_token_hash (token_hash),
    KEY ix_qr_token_permit (permit_id, expires_at),
    FOREIGN KEY (permit_id) REFERENCES permits(id),
    FOREIGN KEY (used_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gate_scan_attempts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    guard_id INT UNSIGNED NOT NULL,
    permit_id INT UNSIGNED NULL,
    decision ENUM('verified','allowed_entry','allowed_exit','denied') NOT NULL,
    reason VARCHAR(120) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX ix_gate_scan_date (created_at),
    FOREIGN KEY (guard_id) REFERENCES users(id),
    FOREIGN KEY (permit_id) REFERENCES permits(id)
) ENGINE=InnoDB;

-- Optional housekeeping: expired tokens are harmless because all access checks
-- enforce expires_at and used_at, regardless of event scheduler state.
DROP EVENT IF EXISTS ev_cleanup_qr_tokens;
CREATE EVENT ev_cleanup_qr_tokens
ON SCHEDULE EVERY 1 DAY STARTS CURRENT_TIMESTAMP + INTERVAL 1 DAY
ON COMPLETION PRESERVE ENABLE
DO DELETE FROM qr_access_tokens
   WHERE (used_at IS NOT NULL AND used_at < NOW() - INTERVAL 30 DAY)
      OR (expires_at < NOW() - INTERVAL 30 DAY);
