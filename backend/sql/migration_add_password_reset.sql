-- Migration script to add password reset functionality
-- Run this script to update existing databases

-- Add password reset columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS reset_token TEXT,
ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;

-- Create index for better performance on reset token lookups
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);
