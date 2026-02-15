CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  google_id VARCHAR(64) UNIQUE,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) UNIQUE,
  avatar_url VARCHAR(255),
  interests VARCHAR(255),
  location VARCHAR(140),
  bio TEXT,
  language VARCHAR(40),
  timezone VARCHAR(40),
  instagram VARCHAR(80),
  twitter VARCHAR(80),
  facebook VARCHAR(80),
  linkedin VARCHAR(120),
  privacy_profile VARCHAR(20) NOT NULL DEFAULT 'public',
  privacy_contact VARCHAR(20) NOT NULL DEFAULT 'members',
  password_hash VARCHAR(255),
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  creator_id INT NOT NULL,
  title VARCHAR(140) NOT NULL,
  description TEXT,
  sport VARCHAR(80) NOT NULL,
  location VARCHAR(140) NOT NULL,
  image_url VARCHAR(255),
  start_time DATETIME NOT NULL,
  end_time DATETIME,
  capacity INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_events_title (title),
  INDEX idx_events_sport (sport),
  INDEX idx_events_location (location),
  INDEX idx_events_start (start_time)
);

CREATE TABLE rsvps (
  user_id INT NOT NULL,
  event_id INT NOT NULL,
  status VARCHAR(16) DEFAULT 'going',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, event_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE event_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  user_id INT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_event_messages_event (event_id),
  INDEX idx_event_messages_created (created_at)
);

CREATE TABLE communities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  creator_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  sport VARCHAR(80),
  region VARCHAR(120),
  image_url VARCHAR(255),
  max_members INT,
  visibility VARCHAR(20) NOT NULL DEFAULT 'public',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_communities_name (name),
  INDEX idx_communities_sport (sport),
  INDEX idx_communities_region (region)
);

CREATE TABLE community_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  community_id INT NOT NULL,
  user_id INT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_community_messages_community (community_id),
  INDEX idx_community_messages_created (created_at)
);

CREATE TABLE community_members (
  community_id INT NOT NULL,
  user_id INT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  status VARCHAR(20) NOT NULL DEFAULT 'approved',
  approved_by INT,
  approved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (community_id, user_id),
  FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_community_members_user (user_id)
);

CREATE TABLE private_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT NOT NULL,
  recipient_id INT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_private_messages_recipient (recipient_id),
  INDEX idx_private_messages_sender (sender_id),
  INDEX idx_private_messages_created (created_at)
);

CREATE TABLE community_invites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  community_id INT NOT NULL,
  email VARCHAR(190) NOT NULL,
  invited_user_id INT,
  invited_by INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_invite (community_id, email),
  INDEX idx_invites_email (email),
  INDEX idx_invites_user (invited_user_id)
);

CREATE TABLE password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_token (token_hash),
  INDEX idx_resets_user (user_id),
  INDEX idx_resets_expires (expires_at)
);

CREATE TABLE public_stats (
  id INT PRIMARY KEY DEFAULT 1,
  users INT NOT NULL DEFAULT 0,
  events INT NOT NULL DEFAULT 0,
  sports INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
