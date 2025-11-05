CREATE DATABASE movie_night_planner;
USE movie_night_planner;

-- 1. Users table
CREATE TABLE Users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Movie_Groups table (renamed to avoid reserved word)
CREATE TABLE Movie_Groups (
    group_id INT PRIMARY KEY AUTO_INCREMENT,
    group_name VARCHAR(100) NOT NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES Users(user_id) ON DELETE CASCADE
);

-- 3. Group_Members table (many-to-many between Users and Movie_Groups)
CREATE TABLE Group_Members (
    group_id INT,
    user_id INT,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES Movie_Groups(group_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

-- 4. Movies table
CREATE TABLE Movies (
    movie_id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    runtime_minutes INT,
    genre VARCHAR(100),
    release_year INT,
    rating DECIMAL(3,1), -- e.g., 7.5 out of 10
    poster_url VARCHAR(500),
    tmdb_id INT UNIQUE -- TMDB API movie ID
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
    FOREIGN KEY (added_by) REFERENCES Users(user_id) ON DELETE CASCADE
);

-- 6. Movie_Votes table (users vote on movies within groups)
CREATE TABLE Movie_Votes (
    user_id INT,
    group_id INT,
    movie_id INT,
    vote_value INT NOT NULL CHECK (vote_value BETWEEN 1 AND 5), -- 1-5 stars
    voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, group_id, movie_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES Movie_Groups(group_id) ON DELETE CASCADE,
    FOREIGN KEY (movie_id) REFERENCES Movies(movie_id) ON DELETE CASCADE
);

-- 7. Movie_Nights table
CREATE TABLE Movie_Nights (
    night_id INT PRIMARY KEY AUTO_INCREMENT,
    group_id INT NOT NULL,
    scheduled_date DATETIME NOT NULL,
    chosen_movie_id INT,
    status ENUM('planned', 'completed', 'cancelled') DEFAULT 'planned',
    FOREIGN KEY (group_id) REFERENCES Movie_Groups(group_id) ON DELETE CASCADE,
    FOREIGN KEY (chosen_movie_id) REFERENCES Movies(movie_id) ON DELETE SET NULL
);

-- 8. Availability table (who's available for each movie night)
CREATE TABLE Availability (
    night_id INT,
    user_id INT,
    is_available BOOLEAN NOT NULL,
    PRIMARY KEY (night_id, user_id),
    FOREIGN KEY (night_id) REFERENCES Movie_Nights(night_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);