-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE user_type_enum AS ENUM ('customer', 'traveler', 'both', 'admin', 'super_admin');
CREATE TYPE user_status_enum AS ENUM ('pending', 'active', 'suspended', 'banned', 'deactivated');
CREATE TYPE verification_level_enum AS ENUM ('unverified', 'email_verified', 'phone_verified', 'id_verified', 'fully_verified');
CREATE TYPE device_type_enum AS ENUM ('mobile', 'web', 'tablet', 'desktop');
CREATE TYPE platform_enum AS ENUM ('ios', 'android', 'web', 'windows', 'macos', 'linux');