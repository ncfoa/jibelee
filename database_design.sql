-- =====================================================
-- P2P DELIVERY PLATFORM - ENTERPRISE DATABASE DESIGN
-- =====================================================
-- 
-- This comprehensive database design supports a peer-to-peer delivery platform
-- that connects travelers with customers who need items delivered.
-- 
-- Key Features:
-- - Multi-role user system (customers, travelers, admins)
-- - Trip management with capacity tracking
-- - Delivery request matching and offers system
-- - QR code-based verification
-- - Dynamic pricing and payment processing
-- - Real-time location tracking
-- - Multi-channel notification system
-- - Comprehensive admin and audit capabilities
-- 
-- Database: PostgreSQL (recommended for enterprise)
-- Version: 14+
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- =====================================================
-- CORE USER MANAGEMENT TABLES
-- =====================================================

-- Users table - Core user information
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified_at TIMESTAMP,
    phone_number VARCHAR(20),
    phone_verified_at TIMESTAMP,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    profile_picture_url VARCHAR(500),
    bio TEXT,
    user_type user_type_enum NOT NULL DEFAULT 'customer',
    status user_status_enum NOT NULL DEFAULT 'pending',
    verification_level verification_level_enum NOT NULL DEFAULT 'unverified',
    preferred_language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    preferred_currency VARCHAR(3) DEFAULT 'USD',
    referral_code VARCHAR(20) UNIQUE,
    referred_by_user_id UUID,
    terms_accepted_at TIMESTAMP,
    privacy_accepted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    
    CONSTRAINT fk_users_referred_by FOREIGN KEY (referred_by_user_id) REFERENCES users(id)
);

-- User types enum
CREATE TYPE user_type_enum AS ENUM ('customer', 'traveler', 'both', 'admin', 'super_admin');

-- User status enum
CREATE TYPE user_status_enum AS ENUM ('pending', 'active', 'suspended', 'banned', 'deactivated');

-- Verification level enum
CREATE TYPE verification_level_enum AS ENUM (
    'unverified', 'email_verified', 'phone_verified', 'id_verified', 'fully_verified'
);

-- User addresses
CREATE TABLE user_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    type address_type_enum NOT NULL DEFAULT 'other',
    label VARCHAR(100),
    street VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(2) NOT NULL,
    coordinates GEOGRAPHY(POINT, 4326),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_user_addresses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TYPE address_type_enum AS ENUM ('home', 'work', 'other');

-- User preferences and settings
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    notification_settings JSONB DEFAULT '{}',
    privacy_settings JSONB DEFAULT '{}',
    location_settings JSONB DEFAULT '{}',
    payment_settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_user_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User statistics (denormalized for performance)
CREATE TABLE user_statistics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    total_trips INTEGER DEFAULT 0,
    total_deliveries INTEGER DEFAULT 0,
    successful_deliveries INTEGER DEFAULT 0,
    cancelled_deliveries INTEGER DEFAULT 0,
    total_earnings DECIMAL(12,2) DEFAULT 0.00,
    total_spent DECIMAL(12,2) DEFAULT 0.00,
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    total_ratings INTEGER DEFAULT 0,
    response_time_minutes INTEGER DEFAULT 0,
    completion_rate DECIMAL(5,2) DEFAULT 0.00,
    last_active_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_user_statistics_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================================
-- AUTHENTICATION & SECURITY TABLES
-- =====================================================

-- User sessions for device management
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    device_id VARCHAR(255),
    device_type device_type_enum,
    platform platform_enum,
    app_version VARCHAR(20),
    push_token VARCHAR(500),
    ip_address INET,
    location VARCHAR(255),
    refresh_token_hash VARCHAR(255),
    expires_at TIMESTAMP NOT NULL,
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP,
    
    CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TYPE device_type_enum AS ENUM ('mobile', 'web', 'tablet', 'desktop');
CREATE TYPE platform_enum AS ENUM ('ios', 'android', 'web', 'windows', 'macos', 'linux');

-- Two-factor authentication
CREATE TABLE user_two_factor_auth (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    secret_key VARCHAR(255) NOT NULL,
    backup_codes TEXT[], -- Array of backup codes
    enabled BOOLEAN DEFAULT FALSE,
    enabled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_user_2fa_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Password reset tokens
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Email verification tokens
CREATE TABLE email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    email VARCHAR(255) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_email_verification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User verification documents
CREATE TABLE user_verification_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    document_type document_type_enum NOT NULL,
    front_image_url VARCHAR(500),
    back_image_url VARCHAR(500),
    selfie_image_url VARCHAR(500),
    status verification_status_enum NOT NULL DEFAULT 'pending',
    verified_by UUID,
    verified_at TIMESTAMP,
    rejection_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_user_verification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_verification_admin FOREIGN KEY (verified_by) REFERENCES users(id)
);

CREATE TYPE document_type_enum AS ENUM ('passport', 'driving_license', 'national_id', 'other');
CREATE TYPE verification_status_enum AS ENUM ('pending', 'approved', 'rejected', 'expired');

-- =====================================================
-- TRIP MANAGEMENT TABLES
-- =====================================================

-- Trips table
CREATE TABLE trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    traveler_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    trip_type trip_type_enum NOT NULL,
    status trip_status_enum NOT NULL DEFAULT 'upcoming',
    
    -- Origin and destination
    origin_address VARCHAR(500) NOT NULL,
    origin_coordinates GEOGRAPHY(POINT, 4326),
    origin_airport VARCHAR(10),
    origin_terminal VARCHAR(50),
    origin_details TEXT,
    
    destination_address VARCHAR(500) NOT NULL,
    destination_coordinates GEOGRAPHY(POINT, 4326),
    destination_airport VARCHAR(10),
    destination_terminal VARCHAR(50),
    destination_details TEXT,
    
    -- Timing
    departure_time TIMESTAMP NOT NULL,
    arrival_time TIMESTAMP NOT NULL,
    estimated_duration INTEGER, -- minutes
    actual_departure_time TIMESTAMP,
    actual_arrival_time TIMESTAMP,
    
    -- Capacity
    weight_capacity DECIMAL(8,2) NOT NULL, -- kg
    volume_capacity DECIMAL(8,2) NOT NULL, -- liters
    item_capacity INTEGER NOT NULL,
    available_weight DECIMAL(8,2) NOT NULL,
    available_volume DECIMAL(8,2) NOT NULL,
    available_items INTEGER NOT NULL,
    
    -- Pricing
    base_price DECIMAL(10,2) NOT NULL,
    price_per_kg DECIMAL(10,2) DEFAULT 0.00,
    price_per_km DECIMAL(10,2) DEFAULT 0.00,
    express_multiplier DECIMAL(3,2) DEFAULT 1.0,
    fragile_multiplier DECIMAL(3,2) DEFAULT 1.0,
    
    -- Restrictions and preferences
    restrictions JSONB DEFAULT '{}',
    preferences JSONB DEFAULT '{}',
    
    -- Recurring trip settings
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_pattern JSONB,
    parent_trip_id UUID,
    
    -- Visibility and automation
    visibility trip_visibility_enum DEFAULT 'public',
    auto_accept BOOLEAN DEFAULT FALSE,
    auto_accept_price DECIMAL(10,2),
    
    tags TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    
    CONSTRAINT fk_trips_traveler FOREIGN KEY (traveler_id) REFERENCES users(id),
    CONSTRAINT fk_trips_parent FOREIGN KEY (parent_trip_id) REFERENCES trips(id)
);

CREATE TYPE trip_type_enum AS ENUM ('flight', 'train', 'bus', 'car', 'ship', 'other');
CREATE TYPE trip_status_enum AS ENUM ('upcoming', 'active', 'completed', 'cancelled', 'delayed');
CREATE TYPE trip_visibility_enum AS ENUM ('public', 'private', 'friends_only');

-- Trip templates for recurring trips
CREATE TABLE trip_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    trip_data JSONB NOT NULL,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_trip_templates_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Trip weather data (cached for performance)
CREATE TABLE trip_weather (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL,
    origin_weather JSONB,
    destination_weather JSONB,
    travel_conditions VARCHAR(50),
    alerts TEXT[],
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_trip_weather_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

-- =====================================================
-- DELIVERY REQUEST & MATCHING TABLES
-- =====================================================

-- Delivery requests
CREATE TABLE delivery_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category item_category_enum NOT NULL,
    status delivery_request_status_enum NOT NULL DEFAULT 'pending',
    urgency urgency_level_enum NOT NULL DEFAULT 'standard',
    
    -- Item details
    item_name VARCHAR(255) NOT NULL,
    item_description TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    weight DECIMAL(8,2) NOT NULL,
    dimensions JSONB, -- {length, width, height}
    value DECIMAL(12,2),
    is_fragile BOOLEAN DEFAULT FALSE,
    is_perishable BOOLEAN DEFAULT FALSE,
    is_hazardous BOOLEAN DEFAULT FALSE,
    requires_signature BOOLEAN DEFAULT FALSE,
    item_images TEXT[],
    
    -- Pickup location
    pickup_address VARCHAR(500) NOT NULL,
    pickup_coordinates GEOGRAPHY(POINT, 4326),
    pickup_contact_name VARCHAR(255),
    pickup_contact_phone VARCHAR(20),
    pickup_instructions TEXT,
    pickup_time_start TIMESTAMP,
    pickup_time_end TIMESTAMP,
    flexible_pickup_timing BOOLEAN DEFAULT FALSE,
    preferred_pickup_days TEXT[],
    
    -- Delivery location
    delivery_address VARCHAR(500) NOT NULL,
    delivery_coordinates GEOGRAPHY(POINT, 4326),
    delivery_contact_name VARCHAR(255),
    delivery_contact_phone VARCHAR(20),
    delivery_instructions TEXT,
    delivery_time_start TIMESTAMP,
    delivery_time_end TIMESTAMP,
    requires_recipient_presence BOOLEAN DEFAULT FALSE,
    
    -- Pricing
    max_price DECIMAL(10,2) NOT NULL,
    auto_accept_price DECIMAL(10,2),
    estimated_price DECIMAL(10,2),
    
    -- Preferences and restrictions
    preferred_travelers UUID[],
    blacklisted_travelers UUID[],
    min_traveler_rating DECIMAL(3,2) DEFAULT 0.00,
    verification_required BOOLEAN DEFAULT FALSE,
    insurance_required BOOLEAN DEFAULT FALSE,
    background_check_required BOOLEAN DEFAULT FALSE,
    
    -- Notifications
    notification_preferences JSONB DEFAULT '{}',
    special_instructions TEXT,
    tags TEXT[],
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    
    CONSTRAINT fk_delivery_requests_customer FOREIGN KEY (customer_id) REFERENCES users(id)
);

CREATE TYPE item_category_enum AS ENUM (
    'documents', 'electronics', 'clothing', 'food', 'fragile', 'books', 'gifts', 'other'
);

CREATE TYPE delivery_request_status_enum AS ENUM (
    'pending', 'matched', 'accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'expired'
);

CREATE TYPE urgency_level_enum AS ENUM ('standard', 'express', 'urgent');

-- Delivery offers from travelers
CREATE TABLE delivery_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_request_id UUID NOT NULL,
    traveler_id UUID NOT NULL,
    trip_id UUID,
    price DECIMAL(10,2) NOT NULL,
    message TEXT,
    estimated_pickup_time TIMESTAMP,
    estimated_delivery_time TIMESTAMP,
    status offer_status_enum NOT NULL DEFAULT 'pending',
    
    -- Guarantees and services
    guarantees JSONB DEFAULT '{}',
    special_services JSONB DEFAULT '{}',
    
    valid_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP,
    declined_at TIMESTAMP,
    declined_reason TEXT,
    
    CONSTRAINT fk_delivery_offers_request FOREIGN KEY (delivery_request_id) REFERENCES delivery_requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_delivery_offers_traveler FOREIGN KEY (traveler_id) REFERENCES users(id),
    CONSTRAINT fk_delivery_offers_trip FOREIGN KEY (trip_id) REFERENCES trips(id),
    CONSTRAINT unique_offer_per_request_traveler UNIQUE(delivery_request_id, traveler_id)
);

CREATE TYPE offer_status_enum AS ENUM ('pending', 'accepted', 'declined', 'expired', 'withdrawn');

-- Actual deliveries (created when offer is accepted)
CREATE TABLE deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_request_id UUID NOT NULL,
    offer_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    traveler_id UUID NOT NULL,
    trip_id UUID,
    
    delivery_number VARCHAR(20) UNIQUE NOT NULL, -- DEL-001234
    status delivery_status_enum NOT NULL DEFAULT 'accepted',
    
    -- Final agreed terms
    final_price DECIMAL(10,2) NOT NULL,
    special_requests TEXT,
    
    -- Timeline tracking
    accepted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    pickup_scheduled_at TIMESTAMP,
    pickup_completed_at TIMESTAMP,
    in_transit_at TIMESTAMP,
    delivery_scheduled_at TIMESTAMP,
    delivery_completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    cancelled_by UUID,
    
    -- Completion details
    pickup_verification JSONB,
    delivery_verification JSONB,
    recipient_signature_url VARCHAR(500),
    delivery_photo_url VARCHAR(500),
    delivery_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_deliveries_request FOREIGN KEY (delivery_request_id) REFERENCES delivery_requests(id),
    CONSTRAINT fk_deliveries_offer FOREIGN KEY (offer_id) REFERENCES delivery_offers(id),
    CONSTRAINT fk_deliveries_customer FOREIGN KEY (customer_id) REFERENCES users(id),
    CONSTRAINT fk_deliveries_traveler FOREIGN KEY (traveler_id) REFERENCES users(id),
    CONSTRAINT fk_deliveries_trip FOREIGN KEY (trip_id) REFERENCES trips(id),
    CONSTRAINT fk_deliveries_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users(id)
);

CREATE TYPE delivery_status_enum AS ENUM (
    'accepted', 'pickup_scheduled', 'picked_up', 'in_transit', 
    'delivery_scheduled', 'delivered', 'cancelled', 'disputed'
);

-- =====================================================
-- QR CODE VERIFICATION TABLES
-- =====================================================

-- QR codes for pickup and delivery verification
CREATE TABLE qr_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID NOT NULL,
    qr_type qr_type_enum NOT NULL,
    encrypted_data TEXT NOT NULL,
    image_data TEXT, -- Base64 encoded image
    download_url VARCHAR(500),
    backup_code VARCHAR(50) NOT NULL,
    security_level security_level_enum NOT NULL DEFAULT 'standard',
    
    -- Security features
    security_features JSONB DEFAULT '{}',
    
    -- Expiration and usage
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    status qr_status_enum NOT NULL DEFAULT 'active',
    
    -- Location binding (optional)
    location_bound BOOLEAN DEFAULT FALSE,
    bound_coordinates GEOGRAPHY(POINT, 4326),
    bound_radius INTEGER, -- meters
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP,
    revoked_reason TEXT,
    
    CONSTRAINT fk_qr_codes_delivery FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE
);

CREATE TYPE qr_type_enum AS ENUM ('pickup', 'delivery');
CREATE TYPE security_level_enum AS ENUM ('standard', 'high', 'maximum');
CREATE TYPE qr_status_enum AS ENUM ('active', 'used', 'expired', 'revoked');

-- QR code scan attempts and history
CREATE TABLE qr_code_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    qr_code_id UUID NOT NULL,
    scanned_by UUID NOT NULL,
    scan_result scan_result_enum NOT NULL,
    scan_location GEOGRAPHY(POINT, 4326),
    device_info JSONB,
    additional_verification JSONB,
    failure_reason TEXT,
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_qr_scans_qr_code FOREIGN KEY (qr_code_id) REFERENCES qr_codes(id) ON DELETE CASCADE,
    CONSTRAINT fk_qr_scans_user FOREIGN KEY (scanned_by) REFERENCES users(id)
);

CREATE TYPE scan_result_enum AS ENUM ('success', 'failed', 'invalid_location', 'expired', 'already_used');

-- Emergency QR overrides
CREATE TABLE qr_emergency_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID NOT NULL,
    qr_code_id UUID,
    override_reason TEXT NOT NULL,
    alternative_verification JSONB,
    requested_by UUID NOT NULL,
    approved_by UUID,
    alternative_code VARCHAR(50) NOT NULL,
    valid_until TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_qr_overrides_delivery FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE,
    CONSTRAINT fk_qr_overrides_qr_code FOREIGN KEY (qr_code_id) REFERENCES qr_codes(id),
    CONSTRAINT fk_qr_overrides_requested_by FOREIGN KEY (requested_by) REFERENCES users(id),
    CONSTRAINT fk_qr_overrides_approved_by FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- =====================================================
-- PAYMENT & FINANCIAL TABLES
-- =====================================================

-- Payment intents and transactions
CREATE TABLE payment_intents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID NOT NULL,
    stripe_payment_intent_id VARCHAR(255) UNIQUE,
    amount INTEGER NOT NULL, -- in cents
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status payment_status_enum NOT NULL DEFAULT 'requires_payment_method',
    payment_method_id VARCHAR(255),
    client_secret VARCHAR(255),
    
    -- Fee breakdown
    platform_fee INTEGER NOT NULL,
    processing_fee INTEGER NOT NULL,
    insurance_fee INTEGER DEFAULT 0,
    total_fees INTEGER NOT NULL,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP,
    failed_at TIMESTAMP,
    failure_reason TEXT,
    
    CONSTRAINT fk_payment_intents_delivery FOREIGN KEY (delivery_id) REFERENCES deliveries(id)
);

CREATE TYPE payment_status_enum AS ENUM (
    'requires_payment_method', 'requires_confirmation', 'requires_action', 
    'processing', 'succeeded', 'failed', 'canceled'
);

-- Escrow management
CREATE TABLE escrow_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_intent_id UUID NOT NULL,
    delivery_id UUID NOT NULL,
    amount INTEGER NOT NULL, -- in cents
    currency VARCHAR(3) NOT NULL,
    status escrow_status_enum NOT NULL DEFAULT 'pending',
    
    hold_until TIMESTAMP NOT NULL,
    release_condition VARCHAR(50) NOT NULL,
    auto_release_enabled BOOLEAN DEFAULT TRUE,
    
    released_at TIMESTAMP,
    released_amount INTEGER,
    release_reason TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_escrow_payment_intent FOREIGN KEY (payment_intent_id) REFERENCES payment_intents(id),
    CONSTRAINT fk_escrow_delivery FOREIGN KEY (delivery_id) REFERENCES deliveries(id)
);

CREATE TYPE escrow_status_enum AS ENUM ('pending', 'held', 'released', 'disputed', 'refunded');

-- Payout accounts for travelers
CREATE TABLE payout_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    stripe_account_id VARCHAR(255) UNIQUE NOT NULL,
    account_type VARCHAR(20) NOT NULL,
    country VARCHAR(2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status payout_account_status_enum NOT NULL DEFAULT 'pending',
    
    capabilities JSONB DEFAULT '{}',
    requirements JSONB DEFAULT '{}',
    verification_status VARCHAR(20),
    verification_details JSONB,
    
    balance_available INTEGER DEFAULT 0, -- in cents
    balance_pending INTEGER DEFAULT 0,
    
    payout_schedule JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP,
    
    CONSTRAINT fk_payout_accounts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TYPE payout_account_status_enum AS ENUM ('pending', 'active', 'restricted', 'inactive');

-- Payouts to travelers
CREATE TABLE payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    payout_account_id UUID NOT NULL,
    stripe_payout_id VARCHAR(255),
    amount INTEGER NOT NULL, -- in cents
    currency VARCHAR(3) NOT NULL,
    type payout_type_enum NOT NULL DEFAULT 'standard',
    status payout_status_enum NOT NULL DEFAULT 'pending',
    
    fee INTEGER DEFAULT 0,
    net_amount INTEGER NOT NULL,
    
    description TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP,
    failed_at TIMESTAMP,
    failure_reason TEXT,
    
    CONSTRAINT fk_payouts_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_payouts_account FOREIGN KEY (payout_account_id) REFERENCES payout_accounts(id)
);

CREATE TYPE payout_type_enum AS ENUM ('standard', 'instant');
CREATE TYPE payout_status_enum AS ENUM ('pending', 'in_transit', 'paid', 'failed', 'canceled');

-- Refunds
CREATE TABLE refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_intent_id UUID NOT NULL,
    stripe_refund_id VARCHAR(255) UNIQUE,
    amount INTEGER NOT NULL, -- in cents
    currency VARCHAR(3) NOT NULL,
    reason refund_reason_enum NOT NULL,
    status refund_status_enum NOT NULL DEFAULT 'pending',
    
    customer_refund INTEGER NOT NULL,
    traveler_compensation INTEGER DEFAULT 0,
    platform_fee_refund INTEGER DEFAULT 0,
    
    description TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    
    CONSTRAINT fk_refunds_payment_intent FOREIGN KEY (payment_intent_id) REFERENCES payment_intents(id)
);

CREATE TYPE refund_reason_enum AS ENUM (
    'delivery_cancelled', 'item_damaged', 'service_not_provided', 
    'customer_request', 'dispute_resolution', 'duplicate'
);

CREATE TYPE refund_status_enum AS ENUM ('pending', 'succeeded', 'failed', 'canceled');

-- Pricing factors and market analysis
CREATE TABLE pricing_factors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_hash VARCHAR(64) NOT NULL, -- Hash of origin-destination
    item_category item_category_enum,
    urgency urgency_level_enum,
    
    base_price DECIMAL(10,2) NOT NULL,
    distance_multiplier DECIMAL(8,4) DEFAULT 1.0000,
    weight_multiplier DECIMAL(8,4) DEFAULT 1.0000,
    urgency_multiplier DECIMAL(8,4) DEFAULT 1.0000,
    category_multiplier DECIMAL(8,4) DEFAULT 1.0000,
    demand_multiplier DECIMAL(8,4) DEFAULT 1.0000,
    
    market_data JSONB DEFAULT '{}',
    
    effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    effective_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_pricing_factor UNIQUE(route_hash, item_category, urgency, effective_from)
);

-- Promotional credits and discounts
CREATE TABLE promotional_credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    credit_type credit_type_enum NOT NULL,
    amount INTEGER NOT NULL, -- in cents
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    description TEXT NOT NULL,
    
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    used_at TIMESTAMP,
    used_for_delivery_id UUID,
    
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT fk_promotional_credits_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_promotional_credits_delivery FOREIGN KEY (used_for_delivery_id) REFERENCES deliveries(id)
);

CREATE TYPE credit_type_enum AS ENUM (
    'referral_bonus', 'first_delivery_bonus', 'loyalty_reward', 'compensation', 'promotional'
);

-- Subscription management
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    stripe_subscription_id VARCHAR(255) UNIQUE,
    plan_id VARCHAR(100) NOT NULL,
    plan_name VARCHAR(255) NOT NULL,
    status subscription_status_enum NOT NULL,
    
    current_period_start TIMESTAMP NOT NULL,
    current_period_end TIMESTAMP NOT NULL,
    
    price INTEGER NOT NULL, -- in cents
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    interval subscription_interval_enum NOT NULL,
    
    trial_start TIMESTAMP,
    trial_end TIMESTAMP,
    
    canceled_at TIMESTAMP,
    cancellation_reason TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_subscriptions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TYPE subscription_status_enum AS ENUM (
    'active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'trialing', 'unpaid'
);

CREATE TYPE subscription_interval_enum AS ENUM ('month', 'year');

-- =====================================================
-- LOCATION & TRACKING TABLES
-- =====================================================

-- Real-time location tracking
CREATE TABLE location_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID NOT NULL,
    user_id UUID NOT NULL,
    coordinates GEOGRAPHY(POINT, 4326) NOT NULL,
    accuracy DECIMAL(8,2), -- meters
    altitude DECIMAL(10,2), -- meters
    bearing DECIMAL(6,2), -- degrees
    speed DECIMAL(8,2), -- km/h
    
    battery_level INTEGER,
    network_type VARCHAR(20),
    
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_location_tracking_delivery FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE,
    CONSTRAINT fk_location_tracking_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Geofences for pickup/delivery zones
CREATE TABLE geofences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type geofence_type_enum NOT NULL,
    delivery_id UUID,
    
    geometry_type geometry_type_enum NOT NULL,
    center_coordinates GEOGRAPHY(POINT, 4326),
    radius INTEGER, -- meters (for circle)
    polygon_coordinates GEOGRAPHY(POLYGON, 4326), -- for polygon
    
    notifications JSONB DEFAULT '{}',
    active BOOLEAN DEFAULT TRUE,
    
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_geofences_delivery FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE
);

CREATE TYPE geofence_type_enum AS ENUM ('pickup', 'delivery', 'restricted', 'safe_zone');
CREATE TYPE geometry_type_enum AS ENUM ('circle', 'polygon');

-- Geofence events (entry/exit)
CREATE TABLE geofence_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    geofence_id UUID NOT NULL,
    user_id UUID NOT NULL,
    delivery_id UUID,
    event_type geofence_event_type_enum NOT NULL,
    coordinates GEOGRAPHY(POINT, 4326),
    dwell_time INTEGER, -- seconds
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_geofence_events_geofence FOREIGN KEY (geofence_id) REFERENCES geofences(id) ON DELETE CASCADE,
    CONSTRAINT fk_geofence_events_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_geofence_events_delivery FOREIGN KEY (delivery_id) REFERENCES deliveries(id)
);

CREATE TYPE geofence_event_type_enum AS ENUM ('enter', 'exit', 'dwell');

-- Route optimization and traffic data
CREATE TABLE route_optimizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID,
    origin_coordinates GEOGRAPHY(POINT, 4326) NOT NULL,
    destination_coordinates GEOGRAPHY(POINT, 4326) NOT NULL,
    waypoints JSONB, -- Array of waypoint coordinates
    
    optimized_route JSONB NOT NULL, -- Route segments and instructions
    total_distance DECIMAL(10,2) NOT NULL, -- km
    total_duration INTEGER NOT NULL, -- minutes
    total_detour DECIMAL(10,2) DEFAULT 0.00, -- km
    
    fuel_cost DECIMAL(8,2),
    toll_cost DECIMAL(8,2),
    
    traffic_conditions JSONB,
    alternatives JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    
    CONSTRAINT fk_route_optimizations_delivery FOREIGN KEY (delivery_id) REFERENCES deliveries(id)
);

-- Emergency location services
CREATE TABLE emergency_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID NOT NULL,
    user_id UUID NOT NULL,
    emergency_type emergency_type_enum NOT NULL,
    coordinates GEOGRAPHY(POINT, 4326) NOT NULL,
    accuracy DECIMAL(8,2),
    
    description TEXT NOT NULL,
    contact_number VARCHAR(20),
    requires_assistance BOOLEAN DEFAULT FALSE,
    severity emergency_severity_enum NOT NULL,
    
    status emergency_status_enum NOT NULL DEFAULT 'reported',
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_emergency_locations_delivery FOREIGN KEY (delivery_id) REFERENCES deliveries(id),
    CONSTRAINT fk_emergency_locations_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TYPE emergency_type_enum AS ENUM ('accident', 'breakdown', 'theft', 'medical', 'other');
CREATE TYPE emergency_severity_enum AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE emergency_status_enum AS ENUM ('reported', 'acknowledged', 'in_progress', 'resolved');

-- =====================================================
-- NOTIFICATION SYSTEM TABLES
-- =====================================================

-- Notification templates
CREATE TABLE notification_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    category notification_category_enum NOT NULL,
    
    -- Template content for different channels
    push_template JSONB,
    email_template JSONB,
    sms_template JSONB,
    in_app_template JSONB,
    
    variables JSONB DEFAULT '[]', -- Array of variable definitions
    targeting JSONB DEFAULT '{}', -- Targeting conditions
    
    status template_status_enum NOT NULL DEFAULT 'active',
    version INTEGER DEFAULT 1,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    
    CONSTRAINT fk_notification_templates_creator FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TYPE notification_category_enum AS ENUM (
    'delivery_update', 'new_request', 'payment', 'system', 'promotional', 'security'
);

CREATE TYPE template_status_enum AS ENUM ('active', 'inactive', 'draft');

-- Notifications sent to users
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    template_id UUID,
    
    notification_type notification_type_enum NOT NULL,
    category notification_category_enum NOT NULL,
    
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Channel-specific data
    push_data JSONB,
    email_data JSONB,
    sms_data JSONB,
    in_app_data JSONB,
    
    status notification_status_enum NOT NULL DEFAULT 'sent',
    priority notification_priority_enum NOT NULL DEFAULT 'normal',
    
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    clicked_at TIMESTAMP,
    
    -- Tracking data
    external_id VARCHAR(255), -- Provider-specific ID (FCM, etc.)
    failure_reason TEXT,
    
    -- Related entities
    delivery_id UUID,
    trip_id UUID,
    
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_template FOREIGN KEY (template_id) REFERENCES notification_templates(id),
    CONSTRAINT fk_notifications_delivery FOREIGN KEY (delivery_id) REFERENCES deliveries(id),
    CONSTRAINT fk_notifications_trip FOREIGN KEY (trip_id) REFERENCES trips(id)
);

CREATE TYPE notification_type_enum AS ENUM ('push', 'email', 'sms', 'in_app');
CREATE TYPE notification_status_enum AS ENUM ('sent', 'delivered', 'read', 'failed', 'bounced');
CREATE TYPE notification_priority_enum AS ENUM ('low', 'normal', 'high', 'urgent');

-- Notification preferences per user
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    
    -- Channel preferences
    push_enabled BOOLEAN DEFAULT TRUE,
    push_categories JSONB DEFAULT '{}',
    push_quiet_hours JSONB,
    
    email_enabled BOOLEAN DEFAULT TRUE,
    email_categories JSONB DEFAULT '{}',
    email_frequency VARCHAR(20) DEFAULT 'immediate',
    
    sms_enabled BOOLEAN DEFAULT FALSE,
    sms_categories JSONB DEFAULT '{}',
    
    in_app_enabled BOOLEAN DEFAULT TRUE,
    in_app_categories JSONB DEFAULT '{}',
    
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_notification_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Device tokens for push notifications
CREATE TABLE device_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    token VARCHAR(500) NOT NULL,
    platform platform_enum NOT NULL,
    device_id VARCHAR(255),
    app_version VARCHAR(20),
    
    active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_device_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT unique_user_device_token UNIQUE(user_id, token)
);

-- Bulk notification operations
CREATE TABLE bulk_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID,
    operation bulk_operation_enum NOT NULL,
    status bulk_status_enum NOT NULL DEFAULT 'processing',
    
    total_recipients INTEGER NOT NULL,
    processed_count INTEGER DEFAULT 0,
    successful_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    
    batch_size INTEGER DEFAULT 100,
    delay_between_batches INTEGER DEFAULT 10, -- seconds
    
    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    
    CONSTRAINT fk_bulk_notifications_template FOREIGN KEY (template_id) REFERENCES notification_templates(id),
    CONSTRAINT fk_bulk_notifications_creator FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TYPE bulk_operation_enum AS ENUM ('send', 'cancel', 'reschedule');
CREATE TYPE bulk_status_enum AS ENUM ('processing', 'completed', 'failed', 'canceled');

-- Webhook configurations for external integrations
CREATE TABLE notification_webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url VARCHAR(500) NOT NULL,
    events TEXT[] NOT NULL, -- Array of event types
    secret VARCHAR(255) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    
    filters JSONB DEFAULT '{}', -- Event filtering criteria
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_triggered_at TIMESTAMP,
    
    -- Statistics
    total_attempts INTEGER DEFAULT 0,
    successful_attempts INTEGER DEFAULT 0,
    failed_attempts INTEGER DEFAULT 0
);

-- =====================================================
-- REVIEW & RATING TABLES
-- =====================================================

-- Reviews between users
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID NOT NULL,
    reviewer_id UUID NOT NULL,
    reviewee_id UUID NOT NULL,
    
    overall_rating INTEGER NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
    comment TEXT,
    
    -- Detailed category ratings
    communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
    punctuality_rating INTEGER CHECK (punctuality_rating >= 1 AND punctuality_rating <= 5),
    carefulness_rating INTEGER CHECK (carefulness_rating >= 1 AND carefulness_rating <= 5),
    friendliness_rating INTEGER CHECK (friendliness_rating >= 1 AND friendliness_rating <= 5),
    
    -- Review metadata
    is_anonymous BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT TRUE,
    
    status review_status_enum NOT NULL DEFAULT 'active',
    moderation_status moderation_status_enum NOT NULL DEFAULT 'approved',
    moderated_by UUID,
    moderated_at TIMESTAMP,
    moderation_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_reviews_delivery FOREIGN KEY (delivery_id) REFERENCES deliveries(id),
    CONSTRAINT fk_reviews_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(id),
    CONSTRAINT fk_reviews_reviewee FOREIGN KEY (reviewee_id) REFERENCES users(id),
    CONSTRAINT fk_reviews_moderator FOREIGN KEY (moderated_by) REFERENCES users(id),
    CONSTRAINT unique_review_per_delivery_reviewer UNIQUE(delivery_id, reviewer_id)
);

CREATE TYPE review_status_enum AS ENUM ('active', 'hidden', 'deleted');
CREATE TYPE moderation_status_enum AS ENUM ('pending', 'approved', 'rejected');

-- Review reports for moderation
CREATE TABLE review_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL,
    reported_by UUID NOT NULL,
    reason report_reason_enum NOT NULL,
    description TEXT,
    status report_status_enum NOT NULL DEFAULT 'pending',
    
    reviewed_by UUID,
    reviewed_at TIMESTAMP,
    resolution_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_review_reports_review FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
    CONSTRAINT fk_review_reports_reporter FOREIGN KEY (reported_by) REFERENCES users(id),
    CONSTRAINT fk_review_reports_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

CREATE TYPE report_reason_enum AS ENUM (
    'inappropriate_content', 'spam', 'harassment', 'false_information', 'other'
);

CREATE TYPE report_status_enum AS ENUM ('pending', 'reviewed', 'resolved', 'dismissed');

-- =====================================================
-- DISPUTE MANAGEMENT TABLES
-- =====================================================

-- Disputes between users
CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID NOT NULL,
    payment_intent_id UUID,
    
    case_number VARCHAR(50) UNIQUE NOT NULL,
    category dispute_category_enum NOT NULL,
    priority dispute_priority_enum NOT NULL DEFAULT 'medium',
    status dispute_status_enum NOT NULL DEFAULT 'open',
    
    complainant_id UUID NOT NULL,
    respondent_id UUID NOT NULL,
    
    amount INTEGER, -- disputed amount in cents
    currency VARCHAR(3) DEFAULT 'USD',
    
    description TEXT NOT NULL,
    requested_resolution dispute_resolution_enum,
    
    assignee_id UUID,
    assigned_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_date TIMESTAMP,
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    
    CONSTRAINT fk_disputes_delivery FOREIGN KEY (delivery_id) REFERENCES deliveries(id),
    CONSTRAINT fk_disputes_payment_intent FOREIGN KEY (payment_intent_id) REFERENCES payment_intents(id),
    CONSTRAINT fk_disputes_complainant FOREIGN KEY (complainant_id) REFERENCES users(id),
    CONSTRAINT fk_disputes_respondent FOREIGN KEY (respondent_id) REFERENCES users(id),
    CONSTRAINT fk_disputes_assignee FOREIGN KEY (assignee_id) REFERENCES users(id)
);

CREATE TYPE dispute_category_enum AS ENUM (
    'item_not_delivered', 'item_damaged', 'service_not_as_described', 
    'unauthorized_charge', 'payment_issue', 'other'
);

CREATE TYPE dispute_priority_enum AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TYPE dispute_status_enum AS ENUM (
    'open', 'under_review', 'awaiting_response', 'resolved', 'escalated', 'closed'
);

CREATE TYPE dispute_resolution_enum AS ENUM (
    'full_refund', 'partial_refund', 'replacement', 'compensation', 'no_action'
);

-- Dispute evidence (documents, photos, etc.)
CREATE TABLE dispute_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dispute_id UUID NOT NULL,
    submitted_by UUID NOT NULL,
    evidence_type evidence_type_enum NOT NULL,
    file_url VARCHAR(500),
    description TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_dispute_evidence_dispute FOREIGN KEY (dispute_id) REFERENCES disputes(id) ON DELETE CASCADE,
    CONSTRAINT fk_dispute_evidence_user FOREIGN KEY (submitted_by) REFERENCES users(id)
);

CREATE TYPE evidence_type_enum AS ENUM ('photo', 'video', 'document', 'audio', 'text');

-- Dispute messages/communications
CREATE TABLE dispute_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dispute_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    message TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE, -- Internal admin notes
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_dispute_messages_dispute FOREIGN KEY (dispute_id) REFERENCES disputes(id) ON DELETE CASCADE,
    CONSTRAINT fk_dispute_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id)
);

-- =====================================================
-- USER BLOCKING & REPORTING TABLES
-- =====================================================

-- User blocking relationships
CREATE TABLE user_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blocker_id UUID NOT NULL,
    blocked_id UUID NOT NULL,
    reason block_reason_enum,
    comment TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_user_blocks_blocker FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_blocks_blocked FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT unique_user_block UNIQUE(blocker_id, blocked_id),
    CONSTRAINT no_self_block CHECK (blocker_id != blocked_id)
);

CREATE TYPE block_reason_enum AS ENUM (
    'inappropriate_behavior', 'spam', 'harassment', 'unreliable', 'other'
);

-- User favorites (travelers that customers prefer)
CREATE TABLE user_favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL,
    traveler_id UUID NOT NULL,
    
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_user_favorites_customer FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_favorites_traveler FOREIGN KEY (traveler_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT unique_user_favorite UNIQUE(customer_id, traveler_id),
    CONSTRAINT no_self_favorite CHECK (customer_id != traveler_id)
);

-- User reports for inappropriate behavior
CREATE TABLE user_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL,
    reported_user_id UUID NOT NULL,
    delivery_id UUID,
    
    category user_report_category_enum NOT NULL,
    description TEXT NOT NULL,
    evidence JSONB DEFAULT '[]', -- Array of evidence objects
    
    status report_status_enum NOT NULL DEFAULT 'pending',
    priority report_priority_enum NOT NULL DEFAULT 'medium',
    
    reviewed_by UUID,
    reviewed_at TIMESTAMP,
    resolution_action TEXT,
    resolution_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_user_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users(id),
    CONSTRAINT fk_user_reports_reported FOREIGN KEY (reported_user_id) REFERENCES users(id),
    CONSTRAINT fk_user_reports_delivery FOREIGN KEY (delivery_id) REFERENCES deliveries(id),
    CONSTRAINT fk_user_reports_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

CREATE TYPE user_report_category_enum AS ENUM (
    'inappropriate_behavior', 'fraud', 'harassment', 'spam', 'safety_concern', 'other'
);

CREATE TYPE report_priority_enum AS ENUM ('low', 'medium', 'high', 'urgent');

-- =====================================================
-- ADMIN & AUDIT TABLES
-- =====================================================

-- Admin users with roles and permissions
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    role admin_role_enum NOT NULL,
    permissions TEXT[] DEFAULT '{}',
    
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    
    CONSTRAINT fk_admin_users_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_admin_users_creator FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TYPE admin_role_enum AS ENUM (
    'super_admin', 'admin', 'moderator', 'support', 'finance', 'analyst'
);

-- Admin activity log for audit purposes
CREATE TABLE admin_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    
    description TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_admin_activity_admin FOREIGN KEY (admin_id) REFERENCES users(id)
);

-- System configuration settings
CREATE TABLE system_configuration (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(50) NOT NULL,
    key VARCHAR(100) NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    
    is_sensitive BOOLEAN DEFAULT FALSE,
    requires_restart BOOLEAN DEFAULT FALSE,
    
    updated_by UUID NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_system_config_updater FOREIGN KEY (updated_by) REFERENCES users(id),
    CONSTRAINT unique_config_key UNIQUE(category, key)
);

-- System backup records
CREATE TABLE system_backups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    backup_type backup_type_enum NOT NULL,
    status backup_status_enum NOT NULL DEFAULT 'in_progress',
    
    size_bytes BIGINT,
    file_path VARCHAR(500),
    download_url VARCHAR(500),
    
    description TEXT,
    include_uploads BOOLEAN DEFAULT TRUE,
    include_logs BOOLEAN DEFAULT FALSE,
    
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    expires_at TIMESTAMP,
    
    created_by UUID,
    
    CONSTRAINT fk_system_backups_creator FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TYPE backup_type_enum AS ENUM ('full', 'incremental', 'database_only', 'files_only');
CREATE TYPE backup_status_enum AS ENUM ('in_progress', 'completed', 'failed', 'expired');

-- Data export requests
CREATE TABLE data_exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    export_type VARCHAR(50) NOT NULL,
    format export_format_enum NOT NULL,
    status export_status_enum NOT NULL DEFAULT 'processing',
    
    filters JSONB DEFAULT '{}',
    fields TEXT[],
    
    estimated_records INTEGER,
    actual_records INTEGER,
    file_size_bytes BIGINT,
    
    download_url VARCHAR(500),
    expires_at TIMESTAMP,
    
    requested_by UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    
    CONSTRAINT fk_data_exports_requester FOREIGN KEY (requested_by) REFERENCES users(id)
);

CREATE TYPE export_format_enum AS ENUM ('csv', 'json', 'xlsx', 'xml');
CREATE TYPE export_status_enum AS ENUM ('processing', 'completed', 'failed', 'expired');

-- =====================================================
-- ANALYTICS & REPORTING TABLES
-- =====================================================

-- Daily aggregated metrics for performance
CREATE TABLE daily_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    metric_type VARCHAR(50) NOT NULL,
    
    -- User metrics
    new_users INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    deleted_users INTEGER DEFAULT 0,
    
    -- Delivery metrics
    new_requests INTEGER DEFAULT 0,
    matched_requests INTEGER DEFAULT 0,
    completed_deliveries INTEGER DEFAULT 0,
    cancelled_deliveries INTEGER DEFAULT 0,
    
    -- Financial metrics
    total_revenue DECIMAL(15,2) DEFAULT 0.00,
    platform_fees DECIMAL(15,2) DEFAULT 0.00,
    refunds DECIMAL(15,2) DEFAULT 0.00,
    
    -- Performance metrics
    average_response_time INTEGER DEFAULT 0, -- milliseconds
    success_rate DECIMAL(5,2) DEFAULT 0.00,
    
    -- System metrics
    api_calls INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_daily_metric UNIQUE(date, metric_type)
);

-- Popular routes for analytics
CREATE TABLE popular_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_hash VARCHAR(64) NOT NULL,
    origin_city VARCHAR(100) NOT NULL,
    origin_country VARCHAR(2) NOT NULL,
    destination_city VARCHAR(100) NOT NULL,
    destination_country VARCHAR(2) NOT NULL,
    
    request_count INTEGER DEFAULT 0,
    completion_count INTEGER DEFAULT 0,
    average_price DECIMAL(10,2) DEFAULT 0.00,
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_popular_route_period UNIQUE(route_hash, period_start, period_end)
);

-- =====================================================
-- INDEXES FOR OPTIMAL PERFORMANCE
-- =====================================================

-- User indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone_number ON users(phone_number);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_user_type ON users(user_type);
CREATE INDEX idx_users_verification_level ON users(verification_level);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_referral_code ON users(referral_code);

-- User addresses indexes
CREATE INDEX idx_user_addresses_user_id ON user_addresses(user_id);
CREATE INDEX idx_user_addresses_coordinates ON user_addresses USING GIST(coordinates);
CREATE INDEX idx_user_addresses_is_default ON user_addresses(user_id, is_default) WHERE is_default = true;

-- Authentication indexes
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_device_id ON user_sessions(device_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_user_sessions_active ON user_sessions(user_id) WHERE revoked_at IS NULL;

-- Trip indexes
CREATE INDEX idx_trips_traveler_id ON trips(traveler_id);
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_trips_departure_time ON trips(departure_time);
CREATE INDEX idx_trips_origin_coordinates ON trips USING GIST(origin_coordinates);
CREATE INDEX idx_trips_destination_coordinates ON trips USING GIST(destination_coordinates);
CREATE INDEX idx_trips_created_at ON trips(created_at);
CREATE INDEX idx_trips_search ON trips(status, departure_time, origin_coordinates, destination_coordinates) 
    WHERE status IN ('upcoming', 'active');

-- Delivery request indexes
CREATE INDEX idx_delivery_requests_customer_id ON delivery_requests(customer_id);
CREATE INDEX idx_delivery_requests_status ON delivery_requests(status);
CREATE INDEX idx_delivery_requests_category ON delivery_requests(category);
CREATE INDEX idx_delivery_requests_urgency ON delivery_requests(urgency);
CREATE INDEX idx_delivery_requests_pickup_coordinates ON delivery_requests USING GIST(pickup_coordinates);
CREATE INDEX idx_delivery_requests_delivery_coordinates ON delivery_requests USING GIST(delivery_coordinates);
CREATE INDEX idx_delivery_requests_created_at ON delivery_requests(created_at);
CREATE INDEX idx_delivery_requests_expires_at ON delivery_requests(expires_at);
CREATE INDEX idx_delivery_requests_search ON delivery_requests(status, category, urgency, pickup_coordinates) 
    WHERE status = 'pending';

-- Delivery offer indexes
CREATE INDEX idx_delivery_offers_request_id ON delivery_offers(delivery_request_id);
CREATE INDEX idx_delivery_offers_traveler_id ON delivery_offers(traveler_id);
CREATE INDEX idx_delivery_offers_trip_id ON delivery_offers(trip_id);
CREATE INDEX idx_delivery_offers_status ON delivery_offers(status);
CREATE INDEX idx_delivery_offers_created_at ON delivery_offers(created_at);

-- Delivery indexes
CREATE INDEX idx_deliveries_customer_id ON deliveries(customer_id);
CREATE INDEX idx_deliveries_traveler_id ON deliveries(traveler_id);
CREATE INDEX idx_deliveries_trip_id ON deliveries(trip_id);
CREATE INDEX idx_deliveries_status ON deliveries(status);
CREATE INDEX idx_deliveries_delivery_number ON deliveries(delivery_number);
CREATE INDEX idx_deliveries_created_at ON deliveries(created_at);
CREATE INDEX idx_deliveries_completed_at ON deliveries(delivery_completed_at);

-- QR code indexes
CREATE INDEX idx_qr_codes_delivery_id ON qr_codes(delivery_id);
CREATE INDEX idx_qr_codes_type ON qr_codes(qr_type);
CREATE INDEX idx_qr_codes_status ON qr_codes(status);
CREATE INDEX idx_qr_codes_expires_at ON qr_codes(expires_at);
CREATE INDEX idx_qr_codes_backup_code ON qr_codes(backup_code);

-- Payment indexes
CREATE INDEX idx_payment_intents_delivery_id ON payment_intents(delivery_id);
CREATE INDEX idx_payment_intents_stripe_id ON payment_intents(stripe_payment_intent_id);
CREATE INDEX idx_payment_intents_status ON payment_intents(status);
CREATE INDEX idx_payment_intents_created_at ON payment_intents(created_at);

-- Escrow indexes
CREATE INDEX idx_escrow_accounts_delivery_id ON escrow_accounts(delivery_id);
CREATE INDEX idx_escrow_accounts_status ON escrow_accounts(status);
CREATE INDEX idx_escrow_accounts_hold_until ON escrow_accounts(hold_until);

-- Payout indexes
CREATE INDEX idx_payout_accounts_user_id ON payout_accounts(user_id);
CREATE INDEX idx_payout_accounts_stripe_id ON payout_accounts(stripe_account_id);
CREATE INDEX idx_payout_accounts_status ON payout_accounts(status);

CREATE INDEX idx_payouts_user_id ON payouts(user_id);
CREATE INDEX idx_payouts_account_id ON payouts(payout_account_id);
CREATE INDEX idx_payouts_status ON payouts(status);
CREATE INDEX idx_payouts_created_at ON payouts(created_at);

-- Location tracking indexes
CREATE INDEX idx_location_tracking_delivery_id ON location_tracking(delivery_id);
CREATE INDEX idx_location_tracking_user_id ON location_tracking(user_id);
CREATE INDEX idx_location_tracking_coordinates ON location_tracking USING GIST(coordinates);
CREATE INDEX idx_location_tracking_timestamp ON location_tracking(timestamp);
CREATE INDEX idx_location_tracking_delivery_time ON location_tracking(delivery_id, timestamp);

-- Geofence indexes
CREATE INDEX idx_geofences_delivery_id ON geofences(delivery_id);
CREATE INDEX idx_geofences_type ON geofences(type);
CREATE INDEX idx_geofences_center ON geofences USING GIST(center_coordinates);
CREATE INDEX idx_geofences_polygon ON geofences USING GIST(polygon_coordinates);
CREATE INDEX idx_geofences_active ON geofences(active) WHERE active = true;

-- Notification indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(notification_type);
CREATE INDEX idx_notifications_category ON notifications(category);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_sent_at ON notifications(sent_at);
CREATE INDEX idx_notifications_delivery_id ON notifications(delivery_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;

-- Device token indexes
CREATE INDEX idx_device_tokens_user_id ON device_tokens(user_id);
CREATE INDEX idx_device_tokens_platform ON device_tokens(platform);
CREATE INDEX idx_device_tokens_active ON device_tokens(user_id) WHERE active = true;

-- Review indexes
CREATE INDEX idx_reviews_delivery_id ON reviews(delivery_id);
CREATE INDEX idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX idx_reviews_reviewee_id ON reviews(reviewee_id);
CREATE INDEX idx_reviews_rating ON reviews(overall_rating);
CREATE INDEX idx_reviews_created_at ON reviews(created_at);
CREATE INDEX idx_reviews_status ON reviews(status, moderation_status);

-- Dispute indexes
CREATE INDEX idx_disputes_delivery_id ON disputes(delivery_id);
CREATE INDEX idx_disputes_case_number ON disputes(case_number);
CREATE INDEX idx_disputes_status ON disputes(status);
CREATE INDEX idx_disputes_assignee_id ON disputes(assignee_id);
CREATE INDEX idx_disputes_created_at ON disputes(created_at);
CREATE INDEX idx_disputes_due_date ON disputes(due_date);

-- Admin activity indexes
CREATE INDEX idx_admin_activity_admin_id ON admin_activity_log(admin_id);
CREATE INDEX idx_admin_activity_action ON admin_activity_log(action);
CREATE INDEX idx_admin_activity_resource ON admin_activity_log(resource_type, resource_id);
CREATE INDEX idx_admin_activity_created_at ON admin_activity_log(created_at);

-- Analytics indexes
CREATE INDEX idx_daily_metrics_date ON daily_metrics(date);
CREATE INDEX idx_daily_metrics_type ON daily_metrics(metric_type);
CREATE INDEX idx_daily_metrics_date_type ON daily_metrics(date, metric_type);

CREATE INDEX idx_popular_routes_hash ON popular_routes(route_hash);
CREATE INDEX idx_popular_routes_period ON popular_routes(period_start, period_end);
CREATE INDEX idx_popular_routes_count ON popular_routes(request_count DESC);

-- Full-text search indexes
CREATE INDEX idx_users_search ON users USING gin(
    (first_name || ' ' || last_name || ' ' || email) gin_trgm_ops
);

CREATE INDEX idx_delivery_requests_search ON delivery_requests USING gin(
    (title || ' ' || description || ' ' || item_name) gin_trgm_ops
);

CREATE INDEX idx_trips_search ON trips USING gin(
    (title || ' ' || description) gin_trgm_ops
);

-- =====================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_addresses_updated_at BEFORE UPDATE ON user_addresses 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_statistics_updated_at BEFORE UPDATE ON user_statistics 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON trips 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_delivery_requests_updated_at BEFORE UPDATE ON delivery_requests 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_delivery_offers_updated_at BEFORE UPDATE ON delivery_offers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deliveries_updated_at BEFORE UPDATE ON deliveries 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_intents_updated_at BEFORE UPDATE ON payment_intents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update user statistics when deliveries are completed
CREATE OR REPLACE FUNCTION update_user_statistics_on_delivery_completion()
RETURNS TRIGGER AS $$
BEGIN
    -- Update traveler statistics
    IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
        UPDATE user_statistics 
        SET 
            total_deliveries = total_deliveries + 1,
            successful_deliveries = successful_deliveries + 1,
            total_earnings = total_earnings + NEW.final_price,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = NEW.traveler_id;
        
        -- Update customer statistics
        UPDATE user_statistics 
        SET 
            total_deliveries = total_deliveries + 1,
            successful_deliveries = successful_deliveries + 1,
            total_spent = total_spent + NEW.final_price,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = NEW.customer_id;
    END IF;
    
    -- Update statistics for cancellations
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
        UPDATE user_statistics 
        SET 
            cancelled_deliveries = cancelled_deliveries + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id IN (NEW.traveler_id, NEW.customer_id);
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_stats_on_delivery_change 
    AFTER UPDATE ON deliveries
    FOR EACH ROW 
    EXECUTE FUNCTION update_user_statistics_on_delivery_completion();

-- Function to update trip capacity when deliveries are accepted
CREATE OR REPLACE FUNCTION update_trip_capacity_on_delivery_change()
RETURNS TRIGGER AS $$
BEGIN
    -- When delivery is accepted, reduce available capacity
    IF NEW.status = 'accepted' AND OLD.status != 'accepted' AND NEW.trip_id IS NOT NULL THEN
        UPDATE trips 
        SET 
            available_weight = available_weight - (
                SELECT weight FROM delivery_requests WHERE id = NEW.delivery_request_id
            ),
            available_volume = available_volume - (
                SELECT COALESCE((dimensions->>'length')::decimal * (dimensions->>'width')::decimal * (dimensions->>'height')::decimal / 1000, 1) 
                FROM delivery_requests WHERE id = NEW.delivery_request_id
            ),
            available_items = available_items - 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.trip_id;
    END IF;
    
    -- When delivery is cancelled or completed, restore capacity
    IF (NEW.status IN ('cancelled', 'delivered') AND OLD.status NOT IN ('cancelled', 'delivered')) 
       AND NEW.trip_id IS NOT NULL THEN
        UPDATE trips 
        SET 
            available_weight = available_weight + (
                SELECT weight FROM delivery_requests WHERE id = NEW.delivery_request_id
            ),
            available_volume = available_volume + (
                SELECT COALESCE((dimensions->>'length')::decimal * (dimensions->>'width')::decimal * (dimensions->>'height')::decimal / 1000, 1) 
                FROM delivery_requests WHERE id = NEW.delivery_request_id
            ),
            available_items = available_items + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.trip_id;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_trip_capacity_on_delivery_change 
    AFTER UPDATE ON deliveries
    FOR EACH ROW 
    EXECUTE FUNCTION update_trip_capacity_on_delivery_change();

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- View for active deliveries with all related information
CREATE VIEW active_deliveries AS
SELECT 
    d.id,
    d.delivery_number,
    d.status,
    d.final_price,
    d.accepted_at,
    d.pickup_completed_at,
    d.delivery_completed_at,
    
    -- Customer info
    c.id as customer_id,
    c.first_name as customer_first_name,
    c.last_name as customer_last_name,
    c.email as customer_email,
    c.phone_number as customer_phone,
    
    -- Traveler info
    t.id as traveler_id,
    t.first_name as traveler_first_name,
    t.last_name as traveler_last_name,
    t.email as traveler_email,
    t.phone_number as traveler_phone,
    
    -- Delivery request info
    dr.title as item_title,
    dr.item_name,
    dr.category,
    dr.weight,
    dr.value,
    dr.pickup_address,
    dr.delivery_address,
    dr.pickup_coordinates,
    dr.delivery_coordinates,
    
    -- Trip info
    tr.title as trip_title,
    tr.trip_type,
    tr.departure_time,
    tr.arrival_time
    
FROM deliveries d
JOIN users c ON d.customer_id = c.id
JOIN users t ON d.traveler_id = t.id
JOIN delivery_requests dr ON d.delivery_request_id = dr.id
LEFT JOIN trips tr ON d.trip_id = tr.id
WHERE d.status NOT IN ('delivered', 'cancelled');

-- View for user profiles with statistics and ratings
CREATE VIEW user_profiles AS
SELECT 
    u.id,
    u.first_name,
    u.last_name,
    u.email,
    u.phone_number,
    u.profile_picture_url,
    u.bio,
    u.user_type,
    u.status,
    u.verification_level,
    u.created_at,
    
    -- Statistics
    us.total_trips,
    us.total_deliveries,
    us.successful_deliveries,
    us.cancelled_deliveries,
    us.total_earnings,
    us.total_spent,
    us.average_rating,
    us.total_ratings,
    us.completion_rate,
    us.last_active_at,
    
    -- Calculated metrics
    CASE 
        WHEN us.total_deliveries > 0 
        THEN ROUND((us.successful_deliveries::decimal / us.total_deliveries * 100), 2)
        ELSE 0 
    END as success_rate,
    
    CASE 
        WHEN us.total_deliveries > 0 
        THEN ROUND((us.total_earnings / us.total_deliveries), 2)
        ELSE 0 
    END as average_earning_per_delivery
    
FROM users u
LEFT JOIN user_statistics us ON u.id = us.user_id
WHERE u.deleted_at IS NULL;

-- View for delivery analytics
CREATE VIEW delivery_analytics AS
SELECT 
    DATE_TRUNC('day', d.created_at) as date,
    COUNT(*) as total_deliveries,
    COUNT(*) FILTER (WHERE d.status = 'delivered') as completed_deliveries,
    COUNT(*) FILTER (WHERE d.status = 'cancelled') as cancelled_deliveries,
    AVG(d.final_price) as average_price,
    SUM(d.final_price) FILTER (WHERE d.status = 'delivered') as total_revenue,
    
    -- Average time metrics (in hours)
    AVG(EXTRACT(EPOCH FROM (d.pickup_completed_at - d.accepted_at))/3600) 
        FILTER (WHERE d.pickup_completed_at IS NOT NULL) as avg_pickup_time_hours,
    AVG(EXTRACT(EPOCH FROM (d.delivery_completed_at - d.pickup_completed_at))/3600) 
        FILTER (WHERE d.delivery_completed_at IS NOT NULL AND d.pickup_completed_at IS NOT NULL) as avg_delivery_time_hours,
    AVG(EXTRACT(EPOCH FROM (d.delivery_completed_at - d.accepted_at))/3600) 
        FILTER (WHERE d.delivery_completed_at IS NOT NULL) as avg_total_time_hours
        
FROM deliveries d
GROUP BY DATE_TRUNC('day', d.created_at)
ORDER BY date DESC;

-- =====================================================
-- SAMPLE DATA FOR TESTING (OPTIONAL)
-- =====================================================

-- Insert sample admin user (password: admin123!)
-- Note: In production, use proper password hashing
INSERT INTO users (
    email, password_hash, first_name, last_name, user_type, status, verification_level,
    terms_accepted_at, privacy_accepted_at
) VALUES (
    'admin@p2pdelivery.com', 
    '$2b$12$LQv3c1yqBwlVHpPjrQXGPOeX0VswqHOpgRt5Q/1txKJNjcbmj6bGu', -- admin123!
    'System', 'Administrator', 'super_admin', 'active', 'fully_verified',
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

-- Insert the admin user into admin_users table
INSERT INTO admin_users (user_id, role, permissions, created_by)
SELECT 
    id, 'super_admin', 
    ARRAY['*'], -- All permissions
    id
FROM users WHERE email = 'admin@p2pdelivery.com';

-- Insert default system configuration
INSERT INTO system_configuration (category, key, value, description, updated_by) 
SELECT 
    'platform', 'maintenance_mode', 'false', 'Enable/disable maintenance mode',
    id FROM users WHERE email = 'admin@p2pdelivery.com'
UNION ALL
SELECT 
    'platform', 'registration_enabled', 'true', 'Enable/disable new user registration',
    id FROM users WHERE email = 'admin@p2pdelivery.com'
UNION ALL
SELECT 
    'platform', 'api_rate_limit', '1000', 'API rate limit per hour for standard users',
    id FROM users WHERE email = 'admin@p2pdelivery.com'
UNION ALL
SELECT 
    'platform', 'platform_fee_rate', '0.10', 'Platform fee rate (10%)',
    id FROM users WHERE email = 'admin@p2pdelivery.com'
UNION ALL
SELECT 
    'limits', 'max_delivery_value', '5000.00', 'Maximum delivery value in USD',
    id FROM users WHERE email = 'admin@p2pdelivery.com'
UNION ALL
SELECT 
    'limits', 'max_delivery_weight', '25.0', 'Maximum delivery weight in kg',
    id FROM users WHERE email = 'admin@p2pdelivery.com';

-- =====================================================
-- MAINTENANCE PROCEDURES
-- =====================================================

-- Procedure to clean up expired tokens and sessions
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void AS $$
BEGIN
    -- Clean up expired password reset tokens
    DELETE FROM password_reset_tokens 
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    -- Clean up expired email verification tokens
    DELETE FROM email_verification_tokens 
    WHERE expires_at < CURRENT_TIMESTAMP AND verified_at IS NULL;
    
    -- Clean up expired user sessions
    DELETE FROM user_sessions 
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    -- Clean up expired QR codes
    UPDATE qr_codes 
    SET status = 'expired' 
    WHERE expires_at < CURRENT_TIMESTAMP AND status = 'active';
    
    -- Clean up expired delivery requests
    UPDATE delivery_requests 
    SET status = 'expired' 
    WHERE expires_at < CURRENT_TIMESTAMP AND status = 'pending';
    
    -- Clean up old location tracking data (keep last 30 days)
    DELETE FROM location_tracking 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    -- Clean up old notification data (keep last 90 days)
    DELETE FROM notifications 
    WHERE sent_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
    
END;
$$ LANGUAGE plpgsql;

-- Schedule the cleanup procedure to run daily (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-expired-data', '0 2 * * *', 'SELECT cleanup_expired_data();');

-- =====================================================
-- PERFORMANCE MONITORING QUERIES
-- =====================================================

-- Query to monitor database performance
CREATE VIEW database_performance AS
SELECT 
    schemaname,
    tablename,
    attname as column_name,
    n_distinct,
    correlation,
    most_common_vals
FROM pg_stats 
WHERE schemaname = 'public'
ORDER BY tablename, attname;

-- Query to monitor index usage
CREATE VIEW index_usage AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Query to monitor table sizes
CREATE VIEW table_sizes AS
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY size_bytes DESC;

-- =====================================================
-- SECURITY POLICIES (ROW LEVEL SECURITY)
-- =====================================================

-- Enable RLS on sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy for users to only see their own data
CREATE POLICY users_own_data ON users
    FOR ALL
    TO authenticated_users
    USING (id = current_user_id() OR is_admin_user());

-- Policy for delivery requests
CREATE POLICY delivery_requests_policy ON delivery_requests
    FOR ALL
    TO authenticated_users
    USING (
        customer_id = current_user_id() 
        OR id IN (
            SELECT delivery_request_id 
            FROM delivery_offers 
            WHERE traveler_id = current_user_id()
        )
        OR is_admin_user()
    );

-- Functions to support RLS policies
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.current_user_id', true)::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admin_users au
        JOIN users u ON au.user_id = u.id
        WHERE u.id = current_user_id()
        AND au.is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FINAL NOTES
-- =====================================================

/*
This comprehensive database design supports a full-featured P2P delivery platform with:

1. SCALABILITY:
   - Proper indexing for fast queries
   - Partitioning-ready structure for large tables
   - Efficient data types and constraints

2. SECURITY:
   - Row Level Security policies
   - Encrypted sensitive data fields
   - Comprehensive audit trails
   - Admin activity logging

3. PERFORMANCE:
   - Optimized indexes for common query patterns
   - Materialized views for analytics
   - Proper foreign key relationships
   - Efficient data retrieval patterns

4. MAINTAINABILITY:
   - Clear naming conventions
   - Comprehensive documentation
   - Automated cleanup procedures
   - Performance monitoring views

5. ENTERPRISE FEATURES:
   - Multi-role user system
   - Advanced payment processing
   - Real-time tracking capabilities
   - Comprehensive notification system
   - Dispute management
   - Analytics and reporting
   - System configuration management
   - Backup and export capabilities

To implement this design:
1. Create a PostgreSQL 14+ database
2. Enable required extensions
3. Run this SQL script
4. Configure application connection strings
5. Set up automated backup procedures
6. Configure monitoring and alerting
7. Implement proper security measures

Remember to:
- Use environment variables for sensitive configuration
- Implement proper authentication and authorization in your application
- Set up database connection pooling
- Configure SSL/TLS for database connections
- Regularly update statistics and reindex as needed
- Monitor query performance and optimize as necessary
*/

COMMIT;