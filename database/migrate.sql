-- Migration script for existing databases
-- Run this if you already have the old schema and need to upgrade

USE movie_night_planner;

-- Add missing columns safely (MySQL 8.0-compatible idempotent helpers)
DELIMITER $$

DROP PROCEDURE IF EXISTS add_column_if_missing $$
CREATE PROCEDURE add_column_if_missing(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_definition VARCHAR(512)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = p_table
      AND column_name = p_column
  ) THEN
    SET @sql = CONCAT(
      'ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_definition
    );
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DELIMITER ;

CALL add_column_if_missing('Users', 'failed_login_attempts', 'INT DEFAULT 0');
CALL add_column_if_missing('Users', 'locked_until', 'DATETIME NULL');
CALL add_column_if_missing('Users', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
CALL add_column_if_missing('Users', 'deleted_at', 'TIMESTAMP NULL DEFAULT NULL');

CALL add_column_if_missing('Movie_Groups', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
CALL add_column_if_missing('Movie_Groups', 'deleted_at', 'TIMESTAMP NULL DEFAULT NULL');

CALL add_column_if_missing('Movies', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
CALL add_column_if_missing('Movies', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
CALL add_column_if_missing('Movies', 'tmdb_id', 'INT NULL');

CALL add_column_if_missing('Movie_Nights', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
CALL add_column_if_missing('Movie_Nights', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

CALL add_column_if_missing('Availability', 'responded_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
CALL add_column_if_missing('Password_Resets', 'token_hash', 'CHAR(64) NULL');

-- Add indexes / foreign keys safely (MySQL 8.0 compatible idempotent helpers)
DELIMITER $$

DROP PROCEDURE IF EXISTS add_index_if_missing $$
CREATE PROCEDURE add_index_if_missing(
  IN p_table VARCHAR(64),
  IN p_index VARCHAR(64),
  IN p_cols VARCHAR(255)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = p_table
      AND index_name = p_index
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table, '` ADD INDEX `', p_index, '` (', p_cols, ')');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DROP PROCEDURE IF EXISTS add_unique_index_if_missing $$
CREATE PROCEDURE add_unique_index_if_missing(
  IN p_table VARCHAR(64),
  IN p_index VARCHAR(64),
  IN p_cols VARCHAR(255)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = p_table
      AND index_name = p_index
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table, '` ADD UNIQUE INDEX `', p_index, '` (', p_cols, ')');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DROP PROCEDURE IF EXISTS drop_fk_if_exists $$
CREATE PROCEDURE drop_fk_if_exists(
  IN p_table VARCHAR(64),
  IN p_fk VARCHAR(64)
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = DATABASE()
      AND table_name = p_table
      AND constraint_name = p_fk
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table, '` DROP FOREIGN KEY `', p_fk, '`');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DROP PROCEDURE IF EXISTS add_fk_if_missing $$
CREATE PROCEDURE add_fk_if_missing(
  IN p_table VARCHAR(64),
  IN p_fk VARCHAR(64),
  IN p_col VARCHAR(64),
  IN p_ref_table VARCHAR(64),
  IN p_ref_col VARCHAR(64),
  IN p_on_delete VARCHAR(32)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = DATABASE()
      AND table_name = p_table
      AND constraint_name = p_fk
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    SET @sql = CONCAT(
      'ALTER TABLE `', p_table, '` ADD CONSTRAINT `', p_fk, '` FOREIGN KEY (`', p_col, '`) ',
      'REFERENCES `', p_ref_table, '`(`', p_ref_col, '`) ON DELETE ', p_on_delete
    );
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DELIMITER ;

CALL add_index_if_missing('Movie_Groups', 'idx_created_by', 'created_by');
CALL add_index_if_missing('Group_Members', 'idx_user_id', 'user_id');
CALL add_index_if_missing('Group_Watchlist', 'idx_added_by', 'added_by');
CALL add_index_if_missing('Movie_Votes', 'idx_group_movie', 'group_id, movie_id');
CALL add_index_if_missing('Movie_Nights', 'idx_group_id', 'group_id');
CALL add_index_if_missing('Movie_Nights', 'idx_chosen_movie', 'chosen_movie_id');
CALL add_index_if_missing('Friend_Requests', 'idx_receiver_status', 'receiver_id, status');
CALL add_index_if_missing('Friend_Requests', 'idx_sender_id', 'sender_id');
CALL add_index_if_missing('Friendships', 'idx_friend_id', 'friend_id');
CALL add_unique_index_if_missing('Movies', 'uq_movies_tmdb_id', 'tmdb_id');
CALL add_unique_index_if_missing('Password_Resets', 'uq_password_resets_token_hash', 'token_hash');
CALL add_index_if_missing('Password_Resets', 'idx_token_hash', 'token_hash');

-- Backfill token hashes for previously plaintext reset tokens.
UPDATE Password_Resets
SET token_hash = SHA2(token, 256)
WHERE token_hash IS NULL AND token IS NOT NULL;

-- Add cascade deletes to Friend_Requests and Friendships
CALL drop_fk_if_exists('Friend_Requests', 'friend_requests_ibfk_1');
CALL drop_fk_if_exists('Friend_Requests', 'friend_requests_ibfk_2');
CALL add_fk_if_missing('Friend_Requests', 'fk_fr_sender', 'sender_id', 'Users', 'user_id', 'CASCADE');
CALL add_fk_if_missing('Friend_Requests', 'fk_fr_receiver', 'receiver_id', 'Users', 'user_id', 'CASCADE');

CALL drop_fk_if_exists('Friendships', 'friendships_ibfk_1');
CALL drop_fk_if_exists('Friendships', 'friendships_ibfk_2');
CALL add_fk_if_missing('Friendships', 'fk_fs_user', 'user_id', 'Users', 'user_id', 'CASCADE');
CALL add_fk_if_missing('Friendships', 'fk_fs_friend', 'friend_id', 'Users', 'user_id', 'CASCADE');

DROP PROCEDURE IF EXISTS add_index_if_missing;
DROP PROCEDURE IF EXISTS add_unique_index_if_missing;
DROP PROCEDURE IF EXISTS drop_fk_if_exists;
DROP PROCEDURE IF EXISTS add_fk_if_missing;
DROP PROCEDURE IF EXISTS add_column_if_missing;

-- Create Notifications table
CREATE TABLE IF NOT EXISTS Notifications (
    notification_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    type ENUM('group_invite', 'movie_night', 'vote_reminder', 'friend_request', 'friend_accepted', 'watchlist_add') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    reference_id INT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    INDEX idx_user_read (user_id, is_read),
    INDEX idx_user_created (user_id, created_at)
);

-- Create Password_Resets table
CREATE TABLE IF NOT EXISTS Password_Resets (
    reset_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    INDEX idx_token_hash (token_hash),
    INDEX idx_user_id (user_id)
);

-- Create Sessions table for persistent session storage
CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
    expires INT UNSIGNED NOT NULL,
    data MEDIUMTEXT COLLATE utf8mb4_bin,
    PRIMARY KEY (session_id)
);
