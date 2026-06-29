-- OSWMS Database Schema (v3) — multi-tenant roles, committee bindings, bracket + safe scoring support
-- Run via database/init.js (requires MySQL, multipleStatements enabled)

DROP DATABASE IF EXISTS oswms_db;
CREATE DATABASE oswms_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE oswms_db;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS schedule_conflicts;
DROP TABLE IF EXISTS user_notifications;
DROP TABLE IF EXISTS standings;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS team_members;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS complaints;
DROP TABLE IF EXISTS participants;
DROP TABLE IF EXISTS committee_memberships;
DROP TABLE IF EXISTS games;
DROP TABLE IF EXISTS venues;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  student_class VARCHAR(50) NULL,
  phone VARCHAR(20) NULL,
  role ENUM('Major_Admin', 'Student', 'Committee_Member') NOT NULL DEFAULT 'Student',
  role_type ENUM('admin', 'student', 'committee') NOT NULL DEFAULT 'student',
  is_admin TINYINT(1) NOT NULL DEFAULT 0,
  is_student TINYINT(1) NOT NULL DEFAULT 1,
  is_committee_member TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

DROP TRIGGER IF EXISTS trg_sync_user_role_insert;
DROP TRIGGER IF EXISTS trg_sync_user_role_update;
CREATE TRIGGER trg_sync_user_role_insert
BEFORE INSERT ON users
FOR EACH ROW
BEGIN
  IF NEW.role = 'Major_Admin' THEN
    SET NEW.role_type = 'admin';
    SET NEW.is_admin = 1;
    SET NEW.is_student = 0;
    SET NEW.is_committee_member = 0;
  ELSEIF NEW.role = 'Committee_Member' THEN
    SET NEW.role_type = 'committee';
    SET NEW.is_admin = 0;
    SET NEW.is_student = 0;
    SET NEW.is_committee_member = 1;
  ELSE
    SET NEW.role_type = 'student';
    SET NEW.is_admin = 0;
    SET NEW.is_student = 1;
    SET NEW.is_committee_member = 0;
  END IF;
END;

CREATE TRIGGER trg_sync_user_role_update
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
  IF NEW.role <> OLD.role THEN
    IF NEW.role = 'Major_Admin' THEN
      SET NEW.role_type = 'admin';
      SET NEW.is_admin = 1;
      SET NEW.is_student = 0;
      SET NEW.is_committee_member = 0;
    ELSEIF NEW.role = 'Committee_Member' THEN
      SET NEW.role_type = 'committee';
      SET NEW.is_admin = 0;
      SET NEW.is_student = 0;
      SET NEW.is_committee_member = 1;
    ELSE
      SET NEW.role_type = 'student';
      SET NEW.is_admin = 0;
      SET NEW.is_student = 1;
      SET NEW.is_committee_member = 0;
    END IF;
  ELSEIF NEW.role_type <> OLD.role_type THEN
    IF NEW.role_type = 'admin' THEN
      SET NEW.role = 'Major_Admin';
      SET NEW.is_admin = 1;
      SET NEW.is_student = 0;
      SET NEW.is_committee_member = 0;
    ELSEIF NEW.role_type = 'committee' THEN
      SET NEW.role = 'Committee_Member';
      SET NEW.is_admin = 0;
      SET NEW.is_student = 0;
      SET NEW.is_committee_member = 1;
    ELSE
      SET NEW.role = 'Student';
      SET NEW.is_admin = 0;
      SET NEW.is_student = 1;
      SET NEW.is_committee_member = 0;
    END IF;
  END IF;
END;

CREATE TABLE games (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  sport_type VARCHAR(60) NOT NULL DEFAULT 'General',
  description TEXT NULL,
  rules_regulations TEXT NULL,
  format ENUM('round_robin', 'knockout') NOT NULL DEFAULT 'round_robin',
  scoring_criteria VARCHAR(255) NULL DEFAULT 'Win=3, Draw=1, Loss=0',
  scoring_mode ENUM('points', 'sets', 'rounds', 'custom') NOT NULL DEFAULT 'points',
  scoring_parameters TEXT NULL,
  equipment_required TEXT NULL,
  approval_status ENUM('draft', 'pending_review', 'approved', 'rejected') NOT NULL DEFAULT 'approved',
  max_teams INT NOT NULL DEFAULT 8,
  max_players_per_team INT NOT NULL DEFAULT 15,
  status ENUM('draft', 'active', 'completed') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Exactly one game committee per user (Major_Admin has no row). Binds Committee_Member to one game.
-- Committee memberships removed: system will keep only Major_Admin and Student roles

CREATE TABLE venues (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  location VARCHAR(200) NULL
) ENGINE=InnoDB;

CREATE TABLE committee_memberships (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  game_id INT NOT NULL,
  assigned_by_user_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_committee_user (user_id),
  UNIQUE KEY uq_committee_game (game_id),
  CONSTRAINT fk_cm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_cm_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  CONSTRAINT fk_cm_assigner FOREIGN KEY (assigned_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  department VARCHAR(100) NULL,
  game_id INT NOT NULL,
  captain_user_id INT NOT NULL,
  verification_status ENUM('open', 'pending_verification', 'verified', 'rejected') NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_teams_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  CONSTRAINT fk_teams_captain FOREIGN KEY (captain_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Join_Request lifecycle: pending -> accepted | rejected (captain). Captain row is accepted on team create.
CREATE TABLE team_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_id INT NOT NULL,
  user_id INT NOT NULL,
  status ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
  request_message VARCHAR(255) NULL,
  reviewed_at TIMESTAMP NULL,
  reviewed_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_team_user (team_id, user_id),
  CONSTRAINT fk_tm_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_tm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_tm_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE participants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  full_name VARCHAR(100) NOT NULL,
  student_class VARCHAR(50) NULL,
  email VARCHAR(100) NULL,
  phone VARCHAR(20) NULL,
  game_id INT NOT NULL,
  team_id INT NULL,
  verification_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_part_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_part_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  CONSTRAINT fk_part_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE matches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  game_id INT NOT NULL,
  team_a_id INT NULL,
  team_b_id INT NULL,
  venue_id INT NULL,
  scheduled_at DATETIME NULL,
  duration_minutes INT NOT NULL DEFAULT 90,
  status ENUM('scheduled', 'ongoing', 'completed', 'cancelled') NOT NULL DEFAULT 'scheduled',
  score_a INT NOT NULL DEFAULT 0,
  score_b INT NOT NULL DEFAULT 0,
  winner_team_id INT NULL,
  round_number INT NOT NULL DEFAULT 1,
  bracket_phase VARCHAR(40) NULL,
  score_updated_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_match_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  CONSTRAINT fk_match_team_a FOREIGN KEY (team_a_id) REFERENCES teams(id) ON DELETE SET NULL,
  CONSTRAINT fk_match_team_b FOREIGN KEY (team_b_id) REFERENCES teams(id) ON DELETE SET NULL,
  CONSTRAINT fk_match_venue FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL,
  CONSTRAINT fk_match_winner FOREIGN KEY (winner_team_id) REFERENCES teams(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_matches_game_time ON matches (game_id, scheduled_at, status);

CREATE TABLE schedule_conflicts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  match_id INT NOT NULL,
  user_id INT NOT NULL,
  conflicting_match_id INT NOT NULL,
  status ENUM('open', 'resolved') NOT NULL DEFAULT 'open',
  resolution_note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_conflict_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  CONSTRAINT fk_conflict_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_conflict_other_match FOREIGN KEY (conflicting_match_id) REFERENCES matches(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE standings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  game_id INT NOT NULL,
  team_id INT NOT NULL,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  draws INT NOT NULL DEFAULT 0,
  points INT NOT NULL DEFAULT 0,
  goals_for INT NOT NULL DEFAULT 0,
  goals_against INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_game_team (game_id, team_id),
  CONSTRAINT fk_st_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  CONSTRAINT fk_st_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Routed to Major_Admin only at API layer; Committee_Member must never list these.
CREATE TABLE complaints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  complaint_code VARCHAR(20) NOT NULL UNIQUE,
  user_id INT NULL,
  is_anonymous TINYINT(1) NOT NULL DEFAULT 0,
  submitted_by VARCHAR(100) NOT NULL,
  email VARCHAR(100) NULL,
  category ENUM('scheduling', 'referee', 'equipment', 'technical', 'other') NOT NULL DEFAULT 'other',
  subject VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  status ENUM('pending', 'under_review', 'resolved') NOT NULL DEFAULT 'pending',
  admin_response TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  CONSTRAINT fk_comp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE user_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('broadcast', 'team_request', 'team_approved', 'team_rejected', 'score_update', 'schedule', 'conflict', 'general') NOT NULL DEFAULT 'general',
  related_id INT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE event_approvals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  game_id INT NOT NULL,
  created_by INT NULL,
  status ENUM('draft', 'pending_review', 'approved', 'rejected') NOT NULL DEFAULT 'pending_review',
  request_notes TEXT NULL,
  review_notes TEXT NULL,
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL,
  reviewed_by INT NULL,
  CONSTRAINT fk_approval_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  CONSTRAINT fk_approval_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_approval_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE volunteers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  full_name VARCHAR(100) NOT NULL,
  student_class VARCHAR(50) NULL,
  email VARCHAR(100) NULL,
  phone VARCHAR(20) NULL,
  role ENUM('referee', 'linesman', 'helper', 'volunteer') NOT NULL DEFAULT 'volunteer',
  assigned_by_user_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_volunteer_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

ALTER TABLE volunteers
  ADD CONSTRAINT fk_volunteer_assigned_by FOREIGN KEY (assigned_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE volunteer_shifts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  volunteer_id INT NOT NULL,
  game_id INT NOT NULL,
  venue_id INT NULL,
  shift_start DATETIME NOT NULL,
  shift_end DATETIME NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 120,
  status ENUM('assigned', 'completed', 'missed') NOT NULL DEFAULT 'assigned',
  qr_code VARCHAR(64) NOT NULL UNIQUE,
  assigned_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_shift_volunteer FOREIGN KEY (volunteer_id) REFERENCES volunteers(id) ON DELETE CASCADE,
  CONSTRAINT fk_shift_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  CONSTRAINT fk_shift_venue FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL,
  CONSTRAINT fk_shift_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE volunteer_attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shift_id INT NOT NULL,
  volunteer_id INT NOT NULL,
  attended TINYINT(1) NOT NULL DEFAULT 0,
  scanned_at TIMESTAMP NULL,
  scanned_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_attendance_shift FOREIGN KEY (shift_id) REFERENCES volunteer_shifts(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_volunteer FOREIGN KEY (volunteer_id) REFERENCES volunteers(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_scanned_by FOREIGN KEY (scanned_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE payment_rates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role ENUM('referee', 'linesman', 'helper', 'volunteer') NOT NULL UNIQUE,
  unit_type ENUM('per_match', 'per_shift', 'fixed') NOT NULL DEFAULT 'per_match',
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00
) ENGINE=InnoDB;

-- Match officials removed (dependent on matches)

CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  volunteer_id INT NOT NULL,
  shift_id INT NULL,
  role ENUM('referee', 'linesman', 'helper', 'volunteer') NOT NULL,
  source_type ENUM('shift') NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status ENUM('pending', 'staged', 'paid', 'rejected') NOT NULL DEFAULT 'pending',
  processed_by INT NULL,
  processed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payment_volunteer FOREIGN KEY (volunteer_id) REFERENCES volunteers(id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_shift FOREIGN KEY (shift_id) REFERENCES volunteer_shifts(id) ON DELETE SET NULL,
  CONSTRAINT fk_payment_processed_by FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- idx_matches_game_time removed (matches table removed)
CREATE INDEX idx_team_members_user_status ON team_members (user_id, status);
CREATE INDEX idx_teams_game_verification ON teams (game_id, verification_status);

INSERT INTO venues (name, location) VALUES
  ('Main Stadium', 'Campus Block A'),
  ('Indoor Arena', 'Sports Complex Level 2'),
  ('North Track', 'Athletics Ground');

INSERT INTO games (name, sport_type, format, description, rules_regulations, equipment_required, max_teams, status) VALUES
  ('Inter-College Football', 'Football', 'round_robin',
   'Annual inter-college football tournament.',
   '## Rules & Regulations\n- FIFA Laws of the Game\n- 90 minutes (45+45)\n- Rolling substitutions allowed\n- Fair play: red card = suspension next match',
   'Football, goals, jerseys', 8, 'active'),
  ('Basketball League', 'Basketball', 'knockout',
   'Single-elimination basketball with bronze match.',
   '## Rules & Regulations\n- FIBA 4x10 min quarters\n- 24 second shot clock\n- Team fouls reset each quarter',
   'Basketball, hoops', 8, 'active'),
  ('Track & Field Relay', 'Athletics', 'round_robin',
   'Relay heats and finals.',
   '## Rules & Regulations\n- 4x100m standard exchange zone\n- Baton must be exchanged within zone',
   'Baton, track lanes', 6, 'draft');

/* Triggers to enforce role-based assignment constraints
   - committee_memberships: only a user with role 'Student' can be assigned as a committee member
     and only a 'Major_Admin' may be the assigner (assigned_by_user_id).
   - volunteers: only a user with role 'Student' may be linked via user_id, and only a
     'Committee_Member' may be the assigner (assigned_by_user_id).
*/
/* Committee triggers removed. */

DROP TRIGGER IF EXISTS trg_check_volunteer_insert;
DROP TRIGGER IF EXISTS trg_check_volunteer_update;
CREATE TRIGGER trg_check_volunteer_insert
BEFORE INSERT ON volunteers
FOR EACH ROW
BEGIN
  DECLARE v_assigner_role VARCHAR(50);
  DECLARE v_user_role VARCHAR(50);
  IF NEW.assigned_by_user_id IS NOT NULL THEN
    SELECT role INTO v_assigner_role FROM users WHERE id = NEW.assigned_by_user_id;
    IF v_assigner_role IS NULL OR v_assigner_role <> 'Committee_Member' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only Committee_Member may assign volunteers.';
    END IF;
  END IF;
  IF NEW.user_id IS NOT NULL THEN
    SELECT role INTO v_user_role FROM users WHERE id = NEW.user_id;
    IF v_user_role IS NULL OR v_user_role <> 'Student' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only users with role Student may be volunteers.';
    END IF;
  END IF;
END;

CREATE TRIGGER trg_check_volunteer_update
BEFORE UPDATE ON volunteers
FOR EACH ROW
BEGIN
  DECLARE v_assigner_role VARCHAR(50);
  DECLARE v_user_role VARCHAR(50);
  IF NEW.assigned_by_user_id IS NOT NULL THEN
    SELECT role INTO v_assigner_role FROM users WHERE id = NEW.assigned_by_user_id;
    IF v_assigner_role IS NULL OR v_assigner_role <> 'Committee_Member' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only Committee_Member may assign volunteers.';
    END IF;
  END IF;
  IF NEW.user_id IS NOT NULL THEN
    SELECT role INTO v_user_role FROM users WHERE id = NEW.user_id;
    IF v_user_role IS NULL OR v_user_role <> 'Student' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only users with role Student may be volunteers.';
    END IF;
  END IF;
END;
