-- =====================================================
-- TRIP MANAGEMENT SERVICE - DATABASE INITIALIZATION
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create database user for the service
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'trip_service') THEN
        CREATE ROLE trip_service WITH LOGIN PASSWORD 'trip_service_password';
    END IF;
END
$$;

-- Grant permissions
GRANT CONNECT ON DATABASE trip_db TO trip_service;
GRANT USAGE ON SCHEMA public TO trip_service;
GRANT CREATE ON SCHEMA public TO trip_service;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO trip_service;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO trip_service;

-- =====================================================
-- TRIP MANAGEMENT TABLES
-- =====================================================

-- Trip types enum
CREATE TYPE trip_type_enum AS ENUM ('flight', 'train', 'bus', 'car', 'ship', 'other');

-- Trip status enum  
CREATE TYPE trip_status_enum AS ENUM ('upcoming', 'active', 'completed', 'cancelled', 'delayed');

-- Trip visibility enum
CREATE TYPE trip_visibility_enum AS ENUM ('public', 'private', 'friends_only');

-- Trips table
CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    traveler_id UUID NOT NULL,
    template_id UUID,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    trip_type trip_type_enum NOT NULL DEFAULT 'other',
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
    estimated_duration INTEGER,
    actual_departure_time TIMESTAMP,
    actual_arrival_time TIMESTAMP,
    
    -- Capacity
    weight_capacity DECIMAL(8,2) NOT NULL DEFAULT 0,
    volume_capacity DECIMAL(8,2) NOT NULL DEFAULT 0,
    item_capacity INTEGER NOT NULL DEFAULT 0,
    available_weight DECIMAL(8,2) NOT NULL DEFAULT 0,
    available_volume DECIMAL(8,2) NOT NULL DEFAULT 0,
    available_items INTEGER NOT NULL DEFAULT 0,
    
    -- Pricing
    base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    price_per_kg DECIMAL(10,2) DEFAULT 0.00,
    price_per_km DECIMAL(10,2) DEFAULT 0.00,
    express_multiplier DECIMAL(3,2) DEFAULT 1.0,
    fragile_multiplier DECIMAL(3,2) DEFAULT 1.0,
    
    -- Restrictions and preferences (JSON fields)
    restrictions JSONB DEFAULT '{}',
    preferences JSONB DEFAULT '{}',
    
    -- Recurring trip information
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_pattern JSONB,
    parent_trip_id UUID,
    
    -- Visibility and automation
    visibility trip_visibility_enum DEFAULT 'public',
    auto_accept BOOLEAN DEFAULT FALSE,
    auto_accept_price DECIMAL(10,2),
    
    -- Additional metadata
    tags TEXT[],
    distance DECIMAL(10,2),
    route_data JSONB,
    
    -- Cancellation information
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Trip templates table
CREATE TABLE IF NOT EXISTS trip_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trip_data JSONB NOT NULL,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    is_public BOOLEAN DEFAULT FALSE,
    category VARCHAR(100),
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Trip weather table
CREATE TABLE IF NOT EXISTS trip_weather (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL,
    origin_weather JSONB,
    destination_weather JSONB,
    route_weather JSONB,
    travel_conditions VARCHAR(50),
    alerts JSONB[],
    impact_assessment JSONB,
    data_source VARCHAR(100) DEFAULT 'openweathermap',
    data_quality VARCHAR(50) DEFAULT 'good',
    forecast_for_date TIMESTAMP,
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES FOR OPTIMAL PERFORMANCE
-- =====================================================

-- Trip indexes
CREATE INDEX IF NOT EXISTS idx_trips_traveler_id ON trips(traveler_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_departure_time ON trips(departure_time);
CREATE INDEX IF NOT EXISTS idx_trips_trip_type ON trips(trip_type);
CREATE INDEX IF NOT EXISTS idx_trips_visibility ON trips(visibility);
CREATE INDEX IF NOT EXISTS idx_trips_is_recurring ON trips(is_recurring);
CREATE INDEX IF NOT EXISTS idx_trips_parent_trip_id ON trips(parent_trip_id);
CREATE INDEX IF NOT EXISTS idx_trips_template_id ON trips(template_id);

-- Geospatial indexes
CREATE INDEX IF NOT EXISTS idx_trips_origin_coordinates ON trips USING GIST(origin_coordinates);
CREATE INDEX IF NOT EXISTS idx_trips_destination_coordinates ON trips USING GIST(destination_coordinates);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_trips_status_departure ON trips(status, departure_time);
CREATE INDEX IF NOT EXISTS idx_trips_traveler_status ON trips(traveler_id, status);
CREATE INDEX IF NOT EXISTS idx_trips_status_visibility ON trips(status, visibility);
CREATE INDEX IF NOT EXISTS idx_trips_type_status ON trips(trip_type, status);

-- Capacity search indexes
CREATE INDEX IF NOT EXISTS idx_trips_capacity ON trips(available_weight, available_volume, available_items);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_trips_created_at ON trips(created_at);
CREATE INDEX IF NOT EXISTS idx_trips_updated_at ON trips(updated_at);

-- Trip template indexes
CREATE INDEX IF NOT EXISTS idx_trip_templates_user_id ON trip_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_templates_is_active ON trip_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_trip_templates_is_public ON trip_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_trip_templates_category ON trip_templates(category);
CREATE INDEX IF NOT EXISTS idx_trip_templates_usage_count ON trip_templates(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_trip_templates_last_used ON trip_templates(last_used_at DESC);

-- Trip weather indexes
CREATE INDEX IF NOT EXISTS idx_trip_weather_trip_id ON trip_weather(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_weather_fetched_at ON trip_weather(fetched_at);
CREATE INDEX IF NOT EXISTS idx_trip_weather_expires_at ON trip_weather(expires_at);
CREATE INDEX IF NOT EXISTS idx_trip_weather_conditions ON trip_weather(travel_conditions);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_trips_search ON trips USING gin(
    (title || ' ' || COALESCE(description, '')) gin_trgm_ops
);

CREATE INDEX IF NOT EXISTS idx_trip_templates_search ON trip_templates USING gin(
    (name || ' ' || COALESCE(description, '')) gin_trgm_ops
);

-- =====================================================
-- FOREIGN KEY CONSTRAINTS
-- =====================================================

-- Trip foreign keys
ALTER TABLE trips ADD CONSTRAINT fk_trips_parent 
    FOREIGN KEY (parent_trip_id) REFERENCES trips(id) ON DELETE SET NULL;

ALTER TABLE trips ADD CONSTRAINT fk_trips_template 
    FOREIGN KEY (template_id) REFERENCES trip_templates(id) ON DELETE SET NULL;

-- Trip weather foreign keys
ALTER TABLE trip_weather ADD CONSTRAINT fk_trip_weather_trip 
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE;

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
DROP TRIGGER IF EXISTS update_trips_updated_at ON trips;
CREATE TRIGGER update_trips_updated_at 
    BEFORE UPDATE ON trips 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trip_templates_updated_at ON trip_templates;
CREATE TRIGGER update_trip_templates_updated_at 
    BEFORE UPDATE ON trip_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trip_weather_updated_at ON trip_weather;
CREATE TRIGGER update_trip_weather_updated_at 
    BEFORE UPDATE ON trip_weather 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SAMPLE DATA FOR TESTING
-- =====================================================

-- Insert sample trip template
INSERT INTO trip_templates (
    user_id, 
    name, 
    description,
    trip_data,
    category,
    tags
) VALUES (
    uuid_generate_v4(),
    'NYC to Boston Business Route',
    'Regular business trip template between New York and Boston',
    '{
        "title": "NYC to Boston Business Trip",
        "trip_type": "flight",
        "origin": {
            "address": "New York, NY, USA",
            "coordinates": {"lat": 40.7128, "lng": -74.0060},
            "airport": "JFK"
        },
        "destination": {
            "address": "Boston, MA, USA", 
            "coordinates": {"lat": 42.3601, "lng": -71.0589},
            "airport": "BOS"
        },
        "capacity": {
            "weight": 5,
            "volume": 10,
            "items": 3
        },
        "pricing": {
            "base_price": 15.00,
            "price_per_kg": 5.00,
            "price_per_km": 0.50
        },
        "restrictions": {
            "no_fragile": false,
            "no_liquids": true,
            "max_item_value": 500.00
        },
        "preferences": {
            "meeting_preference": "airport",
            "communication_preference": "app_only"
        }
    }',
    'business',
    ARRAY['business', 'frequent', 'northeast']
) ON CONFLICT DO NOTHING;

-- =====================================================
-- MAINTENANCE PROCEDURES
-- =====================================================

-- Procedure to clean up expired weather data
CREATE OR REPLACE FUNCTION cleanup_expired_weather_data()
RETURNS void AS $$
BEGIN
    DELETE FROM trip_weather 
    WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '24 hours';
    
    GET DIAGNOSTICS RAISE NOTICE 'Cleaned up % expired weather records', ROW_COUNT;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PERFORMANCE MONITORING VIEWS
-- =====================================================

-- View for active trips with basic information
CREATE OR REPLACE VIEW active_trips AS
SELECT 
    id,
    traveler_id,
    title,
    trip_type,
    status,
    origin_address,
    destination_address,
    departure_time,
    arrival_time,
    available_weight,
    available_volume,
    available_items,
    base_price,
    created_at
FROM trips
WHERE status IN ('upcoming', 'active')
  AND deleted_at IS NULL;

-- View for trip statistics
CREATE OR REPLACE VIEW trip_statistics AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as total_trips,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_trips,
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_trips,
    AVG(base_price) as average_base_price,
    AVG(weight_capacity) as average_weight_capacity,
    AVG(volume_capacity) as average_volume_capacity
FROM trips
WHERE deleted_at IS NULL
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- =====================================================
-- FINAL SETUP
-- =====================================================

-- Update table statistics
ANALYZE trips;
ANALYZE trip_templates;
ANALYZE trip_weather;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Trip Management Service database initialization completed successfully';
    RAISE NOTICE 'Tables created: trips, trip_templates, trip_weather';
    RAISE NOTICE 'Indexes created for optimal performance';
    RAISE NOTICE 'Triggers and functions configured';
    RAISE NOTICE 'Sample data inserted for testing';
END
$$;