-- Migration: Create missing tables
-- Date: 2026-01-29
-- Tables: account_relationships, project_model_accounts, account_model_accounts

USE sns_automation;

-- 1. account_relationships - Manages relationships between accounts (intimacy, interaction probability)
CREATE TABLE IF NOT EXISTS account_relationships (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL COMMENT 'Relationships are project-specific',
  from_account_id INT NOT NULL COMMENT 'The account that has the relationship',
  to_account_id INT NOT NULL COMMENT 'The target account',
  intimacy_level INT NOT NULL DEFAULT 50 COMMENT '0-100, higher = closer relationship',
  relationship_type ENUM('friend', 'acquaintance', 'follower', 'colleague', 'rival', 'stranger') NOT NULL DEFAULT 'acquaintance',
  interaction_probability INT NOT NULL DEFAULT 70 COMMENT '0-100, probability of interacting',
  preferred_reaction_types TEXT COMMENT 'JSON array: ["like", "comment", "retweet"]',
  comment_style ENUM('supportive', 'curious', 'playful', 'professional', 'neutral') DEFAULT 'neutral',
  notes TEXT COMMENT 'Optional notes about the relationship',
  is_active TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. project_model_accounts - Links projects to model accounts for learning
CREATE TABLE IF NOT EXISTS project_model_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL COMMENT 'FK to projects.id',
  model_account_id INT NOT NULL COMMENT 'FK to model_accounts.id',
  auto_apply_learnings TINYINT NOT NULL DEFAULT 0 COMMENT 'Auto-apply new learnings to accounts',
  target_account_ids TEXT COMMENT 'JSON array: specific accounts to apply learnings to (null = all)',
  last_synced_at TIMESTAMP NULL COMMENT 'Last time learnings were synced',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX project_model_accounts_project_idx (project_id),
  INDEX project_model_accounts_model_idx (model_account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. account_model_accounts - Links individual accounts to model accounts for learning
CREATE TABLE IF NOT EXISTS account_model_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL COMMENT 'FK to accounts.id',
  model_account_id INT NOT NULL COMMENT 'FK to model_accounts.id',
  auto_apply_learnings TINYINT NOT NULL DEFAULT 0 COMMENT 'Auto-apply new learnings',
  last_synced_at TIMESTAMP NULL COMMENT 'Last time learnings were synced',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX account_model_accounts_account_idx (account_id),
  INDEX account_model_accounts_model_idx (model_account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verification
SHOW TABLES LIKE '%account%';
