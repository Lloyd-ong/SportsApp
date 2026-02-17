BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
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
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255),
  ADD COLUMN IF NOT EXISTS interests VARCHAR(255),
  ADD COLUMN IF NOT EXISTS location VARCHAR(140),
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS language VARCHAR(40),
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(40),
  ADD COLUMN IF NOT EXISTS instagram VARCHAR(80),
  ADD COLUMN IF NOT EXISTS twitter VARCHAR(80),
  ADD COLUMN IF NOT EXISTS facebook VARCHAR(80),
  ADD COLUMN IF NOT EXISTS linkedin VARCHAR(120),
  ADD COLUMN IF NOT EXISTS privacy_profile VARCHAR(20) NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS privacy_contact VARCHAR(20) NOT NULL DEFAULT 'members',
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  creator_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(140) NOT NULL,
  description TEXT,
  sport VARCHAR(80) NOT NULL,
  location VARCHAR(140) NOT NULL,
  image_url VARCHAR(255),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  capacity INT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS sport VARCHAR(80),
  ADD COLUMN IF NOT EXISTS location VARCHAR(140),
  ADD COLUMN IF NOT EXISTS image_url VARCHAR(255),
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMP,
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMP,
  ADD COLUMN IF NOT EXISTS capacity INT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE events
  ALTER COLUMN sport SET NOT NULL,
  ALTER COLUMN location SET NOT NULL,
  ALTER COLUMN start_time SET NOT NULL;

CREATE TABLE IF NOT EXISTS rsvps (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status VARCHAR(16) DEFAULT 'going',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, event_id)
);

CREATE TABLE IF NOT EXISTS communities (
  id SERIAL PRIMARY KEY,
  creator_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  sport VARCHAR(80),
  region VARCHAR(120),
  image_url VARCHAR(255),
  max_members INT,
  visibility VARCHAR(20) NOT NULL DEFAULT 'public',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS sport VARCHAR(80),
  ADD COLUMN IF NOT EXISTS region VARCHAR(120),
  ADD COLUMN IF NOT EXISTS image_url VARCHAR(255),
  ADD COLUMN IF NOT EXISTS max_members INT,
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS event_messages (
  id SERIAL PRIMARY KEY,
  event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS community_messages (
  id SERIAL PRIMARY KEY,
  community_id INT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS community_members (
  community_id INT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  status VARCHAR(20) NOT NULL DEFAULT 'approved',
  approved_by INT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (community_id, user_id)
);

CREATE TABLE IF NOT EXISTS private_messages (
  id SERIAL PRIMARY KEY,
  sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS community_invites (
  id SERIAL PRIMARY KEY,
  community_id INT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  email VARCHAR(190) NOT NULL,
  invited_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  invited_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (community_id, email)
);

CREATE TABLE IF NOT EXISTS password_resets (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public_stats (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  users INT NOT NULL DEFAULT 0,
  events INT NOT NULL DEFAULT 0,
  sports INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO public_stats (id, users, events, sports)
VALUES (1, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_events_title ON events(title);
CREATE INDEX IF NOT EXISTS idx_events_sport ON events(sport);
CREATE INDEX IF NOT EXISTS idx_events_location ON events(location);
CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_event_messages_event ON event_messages(event_id);
CREATE INDEX IF NOT EXISTS idx_event_messages_created ON event_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_communities_name ON communities(name);
CREATE INDEX IF NOT EXISTS idx_communities_sport ON communities(sport);
CREATE INDEX IF NOT EXISTS idx_communities_region ON communities(region);
CREATE INDEX IF NOT EXISTS idx_community_messages_community ON community_messages(community_id);
CREATE INDEX IF NOT EXISTS idx_community_messages_created ON community_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_community_members_user ON community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_private_messages_recipient ON private_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_private_messages_sender ON private_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_private_messages_created ON private_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_invites_email ON community_invites(email);
CREATE INDEX IF NOT EXISTS idx_invites_user ON community_invites(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_resets_user ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_resets_expires ON password_resets(expires_at);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'events_set_updated_at'
      AND c.relname = 'events'
      AND NOT t.tgisinternal
  ) THEN
    CREATE TRIGGER events_set_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'public_stats_set_updated_at'
      AND c.relname = 'public_stats'
      AND NOT t.tgisinternal
  ) THEN
    CREATE TRIGGER public_stats_set_updated_at
    BEFORE UPDATE ON public_stats
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

COMMIT;
