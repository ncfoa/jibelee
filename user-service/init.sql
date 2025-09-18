-- Create database if it doesn't exist
SELECT 'CREATE DATABASE user_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'user_db');

-- Connect to the user_db database
\c user_db;

-- Create PostGIS extension for geographic data
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create UUID extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create trigram extension for full-text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create enum types
CREATE TYPE user_type_enum AS ENUM ('customer', 'traveler', 'both');
CREATE TYPE user_status_enum AS ENUM ('active', 'inactive', 'suspended', 'pending', 'deleted');
CREATE TYPE verification_level_enum AS ENUM ('unverified', 'email_verified', 'phone_verified', 'id_verified', 'fully_verified');
CREATE TYPE address_type_enum AS ENUM ('home', 'work', 'other');
CREATE TYPE document_type_enum AS ENUM ('passport', 'driving_license', 'national_id', 'utility_bill', 'bank_statement');
CREATE TYPE verification_status_enum AS ENUM ('pending', 'under_review', 'approved', 'rejected', 'expired');
CREATE TYPE review_status_enum AS ENUM ('active', 'hidden', 'deleted', 'disputed');
CREATE TYPE moderation_status_enum AS ENUM ('approved', 'pending', 'flagged', 'removed');
CREATE TYPE block_reason_enum AS ENUM ('inappropriate_behavior', 'spam', 'harassment', 'unreliable', 'fraud_concern', 'safety_concern', 'other');

-- Create indexes for better performance (will be created by Sequelize as well)
-- These are just examples, Sequelize will handle the actual index creation