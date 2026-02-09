-- Migration script for existing databases
-- Run this if you already have the old schema and need to upgrade

USE movie_night_planner;

-- Add missing columns to Users
ALTER TABLE Users
  ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until DATETIME NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL DEFAULT NULL;

-- Add timestamps to Movie_Groups
ALTER TABLE Movie_Groups
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL DEFAULT NULL;

-- Add timestamps to Movies
ALTER TABLE Movies
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Add tmdb_id if missing
ALTER TABLE Movies ADD COLUMN IF NOT EXISTS tmdb_id INT UNIQUE;

-- Add timestamps to Movie_Nights
ALTER TABLE Movie_Nights
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Add responded_at to Availability
ALTER TABLE Availability
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_created_by ON Movie_Groups(created_by);
CREATE INDEX IF NOT EXISTS idx_user_id ON Group_Members(user_id);
CREATE INDEX IF NOT EXISTS idx_added_by ON Group_Watchlist(added_by);
CREATE INDEX IF NOT EXISTS idx_group_movie ON Movie_Votes(group_id, movie_id);
CREATE INDEX IF NOT EXISTS idx_group_id ON Movie_Nights(group_id);
CREATE INDEX IF NOT EXISTS idx_chosen_movie ON Movie_Nights(chosen_movie_id);
CREATE INDEX IF NOT EXISTS idx_receiver_status ON Friend_Requests(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_sender_id ON Friend_Requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_friend_id ON Friendships(friend_id);

-- Add cascade deletes to Friend_Requests and Friendships
ALTER TABLE Friend_Requests DROP FOREIGN KEY IF EXISTS friend_requests_ibfk_1;
ALTER TABLE Friend_Requests DROP FOREIGN KEY IF EXISTS friend_requests_ibfk_2;
ALTER TABLE Friend_Requests
  ADD CONSTRAINT fk_fr_sender FOREIGN KEY (sender_id) REFERENCES Users(user_id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_fr_receiver FOREIGN KEY (receiver_id) REFERENCES Users(user_id) ON DELETE CASCADE;

ALTER TABLE Friendships DROP FOREIGN KEY IF EXISTS friendships_ibfk_1;
ALTER TABLE Friendships DROP FOREIGN KEY IF EXISTS friendships_ibfk_2;
ALTER TABLE Friendships
  ADD CONSTRAINT fk_fs_user FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_fs_friend FOREIGN KEY (friend_id) REFERENCES Users(user_id) ON DELETE CASCADE;

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
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    INDEX idx_token (token),
    INDEX idx_user_id (user_id)
);

-- Create Sessions table for persistent session storage
CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
    expires INT UNSIGNED NOT NULL,
    data MEDIUMTEXT COLLATE utf8mb4_bin,
    PRIMARY KEY (session_id)
);
