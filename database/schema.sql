
CREATE DATABASE IF NOT EXISTS movie_night_planner;
USE movie_night_planner;

-- 1. Users table
CREATE TABLE Users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    bio TEXT,
    favorite_genres VARCHAR(255),
    email_notifications BOOLEAN DEFAULT TRUE,
    group_notifications BOOLEAN DEFAULT TRUE,
    vote_notifications BOOLEAN DEFAULT TRUE,
    public_profile BOOLEAN DEFAULT TRUE,
    failed_login_attempts INT DEFAULT 0,
    locked_until DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL
);

-- 2. Movie_Groups table
CREATE TABLE Movie_Groups (
    group_id INT PRIMARY KEY AUTO_INCREMENT,
    group_name VARCHAR(100) NOT NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (created_by) REFERENCES Users(user_id) ON DELETE CASCADE,
    INDEX idx_created_by (created_by)
);

-- 3. Group_Members table (many-to-many between Users and Movie_Groups)
CREATE TABLE Group_Members (
    group_id INT,
    user_id INT,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES Movie_Groups(group_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
);

-- 4. Movies table
CREATE TABLE Movies (
    movie_id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    runtime_minutes INT,
    genre VARCHAR(100),
    release_year INT,
    rating DECIMAL(3,1),
    poster_url VARCHAR(500),
    tmdb_id INT UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 5. Group_Watchlist table (many-to-many between Movie_Groups and Movies)
CREATE TABLE Group_Watchlist (
    group_id INT,
    movie_id INT,
    added_by INT NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, movie_id),
    FOREIGN KEY (group_id) REFERENCES Movie_Groups(group_id) ON DELETE CASCADE,
    FOREIGN KEY (movie_id) REFERENCES Movies(movie_id) ON DELETE CASCADE,
    FOREIGN KEY (added_by) REFERENCES Users(user_id) ON DELETE CASCADE,
    INDEX idx_added_by (added_by)
);

-- 6. Movie_Votes table (users vote on movies within groups)
CREATE TABLE Movie_Votes (
    user_id INT,
    group_id INT,
    movie_id INT,
    vote_value INT NOT NULL CHECK (vote_value BETWEEN 1 AND 5),
    voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, group_id, movie_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES Movie_Groups(group_id) ON DELETE CASCADE,
    FOREIGN KEY (movie_id) REFERENCES Movies(movie_id) ON DELETE CASCADE,
    INDEX idx_group_movie (group_id, movie_id)
);

-- 7. Movie_Nights table
CREATE TABLE Movie_Nights (
    night_id INT PRIMARY KEY AUTO_INCREMENT,
    group_id INT NOT NULL,
    scheduled_date DATETIME NOT NULL,
    chosen_movie_id INT,
    status ENUM('planned', 'completed', 'cancelled') DEFAULT 'planned',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES Movie_Groups(group_id) ON DELETE CASCADE,
    FOREIGN KEY (chosen_movie_id) REFERENCES Movies(movie_id) ON DELETE SET NULL,
    INDEX idx_group_id (group_id),
    INDEX idx_chosen_movie (chosen_movie_id)
);

-- 8. Availability table (who's available for each movie night)
CREATE TABLE Availability (
    night_id INT,
    user_id INT,
    is_available BOOLEAN NOT NULL,
    responded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (night_id, user_id),
    FOREIGN KEY (night_id) REFERENCES Movie_Nights(night_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
);

-- 9. Friend_Requests table
CREATE TABLE Friend_Requests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id INT NOT NULL,
    receiver_id INT NOT NULL,
    status ENUM('pending', 'accepted', 'declined') DEFAULT 'pending',
    requested_at DATETIME NOT NULL,
    responded_at DATETIME,
    FOREIGN KEY (sender_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    CHECK (sender_id != receiver_id),
    UNIQUE KEY uq_pending_request (sender_id, receiver_id),
    INDEX idx_receiver_status (receiver_id, status),
    INDEX idx_sender_id (sender_id)
);

-- 10. Friendships table (store both directions)
CREATE TABLE Friendships (
    user_id INT NOT NULL,
    friend_id INT NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (user_id, friend_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    CHECK (user_id != friend_id),
    INDEX idx_friend_id (friend_id)
);

-- 11. Notifications table
CREATE TABLE Notifications (
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

-- 12. Password_Resets table
CREATE TABLE Password_Resets (
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

-- 13. Sessions table (for express-mysql-session)
CREATE TABLE sessions (
    session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
    expires INT UNSIGNED NOT NULL,
    data MEDIUMTEXT COLLATE utf8mb4_bin,
    PRIMARY KEY (session_id)
);
