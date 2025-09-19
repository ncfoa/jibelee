-- Initialize the location database with PostGIS extension
-- This file is run when the PostgreSQL container starts for the first time

-- Create the PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE geofence_type_enum AS ENUM ('pickup', 'delivery', 'restricted', 'safe_zone');
CREATE TYPE geometry_type_enum AS ENUM ('circle', 'polygon');
CREATE TYPE geofence_event_type_enum AS ENUM ('enter', 'exit', 'dwell');
CREATE TYPE emergency_type_enum AS ENUM ('accident', 'breakdown', 'theft', 'medical', 'other');
CREATE TYPE emergency_severity_enum AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE emergency_status_enum AS ENUM ('reported', 'acknowledged', 'in_progress', 'resolved');
CREATE TYPE tracking_status_enum AS ENUM ('active', 'paused', 'stopped', 'completed');

-- Create location_tracking table
CREATE TABLE IF NOT EXISTS location_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID NOT NULL,
    user_id UUID NOT NULL,
    coordinates GEOGRAPHY(POINT, 4326) NOT NULL,
    accuracy DECIMAL(8,2),
    altitude DECIMAL(10,2),
    bearing DECIMAL(6,2),
    speed DECIMAL(8,2),
    battery_level INTEGER,
    network_type VARCHAR(20),
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for location_tracking
CREATE INDEX IF NOT EXISTS idx_location_tracking_delivery_time ON location_tracking(delivery_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_location_tracking_user_time ON location_tracking(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_location_tracking_timestamp ON location_tracking(timestamp);
CREATE INDEX IF NOT EXISTS idx_location_tracking_coordinates ON location_tracking USING GIST(coordinates);

-- Create geofences table
CREATE TABLE IF NOT EXISTS geofences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type geofence_type_enum NOT NULL,
    delivery_id UUID,
    geometry_type geometry_type_enum NOT NULL,
    center_coordinates GEOGRAPHY(POINT, 4326),
    radius INTEGER,
    polygon_coordinates GEOGRAPHY(POLYGON, 4326),
    notifications JSONB DEFAULT '{}',
    active BOOLEAN DEFAULT TRUE,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    timezone VARCHAR(50) DEFAULT 'UTC',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for geofences
CREATE INDEX IF NOT EXISTS idx_geofences_delivery_active ON geofences(delivery_id, active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_geofences_type_active ON geofences(type, active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_geofences_center ON geofences USING GIST(center_coordinates);
CREATE INDEX IF NOT EXISTS idx_geofences_polygon ON geofences USING GIST(polygon_coordinates);

-- Create geofence_events table
CREATE TABLE IF NOT EXISTS geofence_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    geofence_id UUID NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    delivery_id UUID,
    event_type geofence_event_type_enum NOT NULL,
    coordinates GEOGRAPHY(POINT, 4326),
    dwell_time INTEGER,
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for geofence_events
CREATE INDEX IF NOT EXISTS idx_geofence_events_geofence_time ON geofence_events(geofence_id, triggered_at);
CREATE INDEX IF NOT EXISTS idx_geofence_events_user_time ON geofence_events(user_id, triggered_at);
CREATE INDEX IF NOT EXISTS idx_geofence_events_delivery_time ON geofence_events(delivery_id, triggered_at);

-- Create emergency_locations table
CREATE TABLE IF NOT EXISTS emergency_locations (
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for emergency_locations
CREATE INDEX IF NOT EXISTS idx_emergency_locations_status_time ON emergency_locations(status, created_at);
CREATE INDEX IF NOT EXISTS idx_emergency_locations_severity_time ON emergency_locations(severity, created_at);
CREATE INDEX IF NOT EXISTS idx_emergency_locations_type ON emergency_locations(emergency_type);
CREATE INDEX IF NOT EXISTS idx_emergency_locations_coordinates ON emergency_locations USING GIST(coordinates);

-- Create tracking_sessions table
CREATE TABLE IF NOT EXISTS tracking_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID NOT NULL UNIQUE,
    user_id UUID NOT NULL,
    status tracking_status_enum NOT NULL DEFAULT 'active',
    settings JSONB DEFAULT '{}',
    privacy_settings JSONB DEFAULT '{}',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    stopped_at TIMESTAMP,
    last_update_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_updates INTEGER DEFAULT 0,
    total_distance DECIMAL(10,2) DEFAULT 0,
    total_duration INTEGER DEFAULT 0
);

-- Create indexes for tracking_sessions
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_user_status ON tracking_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_status_started ON tracking_sessions(status, started_at);

-- Create privacy_settings table
CREATE TABLE IF NOT EXISTS privacy_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    tracking_level VARCHAR(20) DEFAULT 'precise',
    share_with JSONB DEFAULT '{}',
    data_retention_days INTEGER DEFAULT 90,
    delete_after_delivery BOOLEAN DEFAULT FALSE,
    anonymization_enabled BOOLEAN DEFAULT TRUE,
    anonymization_delay_hours INTEGER DEFAULT 24,
    notification_preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for privacy_settings
CREATE INDEX IF NOT EXISTS idx_privacy_settings_user ON privacy_settings(user_id);

-- Create location_cache table for offline sync
CREATE TABLE IF NOT EXISTS location_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID NOT NULL,
    user_id UUID NOT NULL,
    cached_locations JSONB NOT NULL,
    sync_reason VARCHAR(50),
    processed BOOLEAN DEFAULT FALSE,
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- Create indexes for location_cache
CREATE INDEX IF NOT EXISTS idx_location_cache_processed_time ON location_cache(processed, cached_at);
CREATE INDEX IF NOT EXISTS idx_location_cache_delivery_processed ON location_cache(delivery_id, processed);

-- Create route_optimizations table
CREATE TABLE IF NOT EXISTS route_optimizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID,
    origin_coordinates GEOGRAPHY(POINT, 4326) NOT NULL,
    destination_coordinates GEOGRAPHY(POINT, 4326) NOT NULL,
    waypoints JSONB,
    optimized_route JSONB NOT NULL,
    total_distance DECIMAL(10,2) NOT NULL,
    total_duration INTEGER NOT NULL,
    total_detour DECIMAL(10,2) DEFAULT 0.00,
    fuel_cost DECIMAL(8,2),
    toll_cost DECIMAL(8,2),
    traffic_conditions JSONB,
    alternatives JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Create indexes for route_optimizations
CREATE INDEX IF NOT EXISTS idx_route_optimizations_delivery ON route_optimizations(delivery_id);
CREATE INDEX IF NOT EXISTS idx_route_optimizations_created ON route_optimizations(created_at);
CREATE INDEX IF NOT EXISTS idx_route_optimizations_expires ON route_optimizations(expires_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_geofences_updated_at BEFORE UPDATE ON geofences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_privacy_settings_updated_at BEFORE UPDATE ON privacy_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for development (optional)
INSERT INTO privacy_settings (user_id, tracking_level, share_with, data_retention_days, anonymization_enabled) 
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'precise',
    '{"customers": true, "platform": true, "emergencyContacts": true, "thirdParties": false}',
    90,
    true
) ON CONFLICT (user_id) DO NOTHING;

-- Create a sample geofence for testing
INSERT INTO geofences (
    name, 
    type, 
    delivery_id, 
    geometry_type, 
    center_coordinates, 
    radius, 
    notifications
) VALUES (
    'Test Pickup Zone',
    'pickup',
    '00000000-0000-0000-0000-000000000001',
    'circle',
    ST_GeogFromText('POINT(-74.0060 40.7128)'),
    100,
    '{"onEntry": true, "onExit": true, "onDwell": {"enabled": true, "duration": 300}}'
) ON CONFLICT DO NOTHING;

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO location_service_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO location_service_user;

-- Log successful initialization
SELECT 'Location database initialized successfully with PostGIS support' as status;