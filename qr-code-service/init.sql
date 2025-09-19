-- QR Code Service Database Initialization
-- This script creates the database schema for the QR Code Service

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Create custom enums
CREATE TYPE qr_type_enum AS ENUM ('pickup', 'delivery');
CREATE TYPE security_level_enum AS ENUM ('standard', 'high', 'maximum');
CREATE TYPE qr_status_enum AS ENUM ('active', 'used', 'expired', 'revoked');
CREATE TYPE scan_result_enum AS ENUM ('success', 'failed', 'invalid_location', 'expired', 'already_used', 'unauthorized', 'invalid_data');

-- QR Codes Table
CREATE TABLE qr_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID NOT NULL,
    qr_type qr_type_enum NOT NULL,
    encrypted_data TEXT NOT NULL,
    image_data TEXT, -- Base64 encoded image
    download_url VARCHAR(500),
    backup_code_hash VARCHAR(255) NOT NULL, -- Hashed backup code
    security_level security_level_enum NOT NULL DEFAULT 'standard',
    
    -- Security features
    security_features JSONB DEFAULT '{}',
    
    -- Expiration and usage
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    status qr_status_enum NOT NULL DEFAULT 'active',
    
    -- Location binding (optional)
    location_bound BOOLEAN DEFAULT FALSE,
    bound_coordinates GEOGRAPHY(POINT, 4326),
    bound_radius INTEGER, -- meters
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_reason TEXT,
    revoked_by UUID,
    
    -- Additional data for complex scenarios
    additional_data JSONB DEFAULT '{}',
    
    -- Version for optimistic locking
    version INTEGER DEFAULT 1,
    
    -- Constraints
    CONSTRAINT qr_codes_delivery_type_unique UNIQUE (delivery_id, qr_type),
    CONSTRAINT qr_codes_radius_positive CHECK (bound_radius > 0),
    CONSTRAINT qr_codes_expires_future CHECK (expires_at > created_at)
);

-- QR Code Scans Table
CREATE TABLE qr_code_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    qr_code_id UUID NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
    scanned_by UUID NOT NULL,
    scan_result scan_result_enum NOT NULL,
    scan_location GEOGRAPHY(POINT, 4326),
    scan_accuracy FLOAT, -- GPS accuracy in meters
    device_info JSONB DEFAULT '{}',
    additional_verification JSONB DEFAULT '{}',
    failure_reason TEXT,
    response_time_ms INTEGER,
    ip_address INET,
    user_agent TEXT,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Security tracking
    security_flags JSONB DEFAULT '{}',
    risk_score FLOAT DEFAULT 0.0,
    
    -- Indexes will be added below
    CONSTRAINT qr_scans_accuracy_positive CHECK (scan_accuracy >= 0),
    CONSTRAINT qr_scans_response_time_positive CHECK (response_time_ms >= 0),
    CONSTRAINT qr_scans_risk_score_range CHECK (risk_score >= 0.0 AND risk_score <= 1.0)
);

-- Emergency Overrides Table
CREATE TABLE qr_emergency_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID NOT NULL,
    qr_code_id UUID REFERENCES qr_codes(id) ON DELETE SET NULL,
    override_reason TEXT NOT NULL,
    description TEXT,
    alternative_verification JSONB DEFAULT '{}',
    requested_by UUID NOT NULL,
    approved_by UUID,
    alternative_code_hash VARCHAR(255) NOT NULL, -- Hashed alternative code
    valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    used_by UUID,
    use_location GEOGRAPHY(POINT, 4326),
    verification_evidence JSONB DEFAULT '{}',
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'used', 'expired')),
    approval_notes TEXT,
    additional_restrictions JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT emergency_overrides_valid_until_future CHECK (valid_until > created_at),
    CONSTRAINT emergency_overrides_approval_logic CHECK (
        (status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL) OR
        (status != 'approved')
    )
);

-- QR Code Analytics Table (for performance monitoring)
CREATE TABLE qr_code_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    qr_type qr_type_enum,
    security_level security_level_enum,
    
    -- Metrics
    total_generated INTEGER DEFAULT 0,
    total_scanned INTEGER DEFAULT 0,
    successful_scans INTEGER DEFAULT 0,
    failed_scans INTEGER DEFAULT 0,
    expired_codes INTEGER DEFAULT 0,
    revoked_codes INTEGER DEFAULT 0,
    
    -- Performance metrics
    avg_scan_time_ms FLOAT DEFAULT 0,
    avg_generation_time_ms FLOAT DEFAULT 0,
    
    -- Security metrics
    security_incidents INTEGER DEFAULT 0,
    emergency_overrides INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT qr_analytics_date_unique UNIQUE (date, qr_type, security_level),
    CONSTRAINT qr_analytics_non_negative CHECK (
        total_generated >= 0 AND total_scanned >= 0 AND 
        successful_scans >= 0 AND failed_scans >= 0 AND
        expired_codes >= 0 AND revoked_codes >= 0 AND
        security_incidents >= 0 AND emergency_overrides >= 0
    )
);

-- Security Audit Log Table
CREATE TABLE qr_security_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    qr_code_id UUID REFERENCES qr_codes(id) ON DELETE SET NULL,
    delivery_id UUID,
    user_id UUID,
    ip_address INET,
    user_agent TEXT,
    location GEOGRAPHY(POINT, 4326),
    
    -- Event details
    event_data JSONB DEFAULT '{}',
    risk_indicators JSONB DEFAULT '{}',
    
    -- Response and resolution
    response_action VARCHAR(100),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID,
    resolution_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance Optimization

-- QR Codes indexes
CREATE INDEX idx_qr_codes_delivery_id ON qr_codes(delivery_id);
CREATE INDEX idx_qr_codes_delivery_type ON qr_codes(delivery_id, qr_type);
CREATE INDEX idx_qr_codes_status ON qr_codes(status);
CREATE INDEX idx_qr_codes_expires_at ON qr_codes(expires_at);
CREATE INDEX idx_qr_codes_status_expires ON qr_codes(status, expires_at);
CREATE INDEX idx_qr_codes_created_by ON qr_codes(created_by);
CREATE INDEX idx_qr_codes_security_level ON qr_codes(security_level);
CREATE INDEX idx_qr_codes_location_bound ON qr_codes(location_bound) WHERE location_bound = true;
CREATE INDEX idx_qr_codes_bound_coordinates ON qr_codes USING GIST(bound_coordinates) WHERE bound_coordinates IS NOT NULL;

-- QR Code Scans indexes
CREATE INDEX idx_qr_scans_qr_code_id ON qr_code_scans(qr_code_id);
CREATE INDEX idx_qr_scans_scanned_by ON qr_code_scans(scanned_by);
CREATE INDEX idx_qr_scans_result ON qr_code_scans(scan_result);
CREATE INDEX idx_qr_scans_scanned_at ON qr_code_scans(scanned_at);
CREATE INDEX idx_qr_scans_qr_code_time ON qr_code_scans(qr_code_id, scanned_at);
CREATE INDEX idx_qr_scans_location ON qr_code_scans USING GIST(scan_location) WHERE scan_location IS NOT NULL;
CREATE INDEX idx_qr_scans_risk_score ON qr_code_scans(risk_score) WHERE risk_score > 0.5;

-- Emergency Overrides indexes
CREATE INDEX idx_emergency_overrides_delivery_id ON qr_emergency_overrides(delivery_id);
CREATE INDEX idx_emergency_overrides_qr_code_id ON qr_emergency_overrides(qr_code_id);
CREATE INDEX idx_emergency_overrides_requested_by ON qr_emergency_overrides(requested_by);
CREATE INDEX idx_emergency_overrides_approved_by ON qr_emergency_overrides(approved_by);
CREATE INDEX idx_emergency_overrides_status ON qr_emergency_overrides(status);
CREATE INDEX idx_emergency_overrides_valid_until ON qr_emergency_overrides(valid_until);
CREATE INDEX idx_emergency_overrides_created_at ON qr_emergency_overrides(created_at);

-- Analytics indexes
CREATE INDEX idx_qr_analytics_date ON qr_code_analytics(date);
CREATE INDEX idx_qr_analytics_date_type ON qr_code_analytics(date, qr_type);
CREATE INDEX idx_qr_analytics_date_security ON qr_code_analytics(date, security_level);

-- Security Audit indexes
CREATE INDEX idx_security_audit_event_type ON qr_security_audit(event_type);
CREATE INDEX idx_security_audit_severity ON qr_security_audit(severity);
CREATE INDEX idx_security_audit_qr_code_id ON qr_security_audit(qr_code_id);
CREATE INDEX idx_security_audit_user_id ON qr_security_audit(user_id);
CREATE INDEX idx_security_audit_created_at ON qr_security_audit(created_at);
CREATE INDEX idx_security_audit_ip_address ON qr_security_audit(ip_address);

-- Triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_qr_codes_updated_at 
    BEFORE UPDATE ON qr_codes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for automatic QR code expiration
CREATE OR REPLACE FUNCTION expire_qr_codes()
RETURNS void AS $$
BEGIN
    UPDATE qr_codes 
    SET status = 'expired', updated_at = CURRENT_TIMESTAMP
    WHERE status = 'active' AND expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old scan records (for GDPR compliance)
CREATE OR REPLACE FUNCTION cleanup_old_scans(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM qr_code_scans 
    WHERE scanned_at < CURRENT_TIMESTAMP - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get QR code statistics
CREATE OR REPLACE FUNCTION get_qr_code_stats(
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    date DATE,
    total_generated BIGINT,
    total_scanned BIGINT,
    success_rate NUMERIC,
    avg_scan_time NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE(qc.created_at) as date,
        COUNT(qc.id) as total_generated,
        COUNT(qcs.id) as total_scanned,
        CASE 
            WHEN COUNT(qcs.id) > 0 THEN 
                ROUND(COUNT(CASE WHEN qcs.scan_result = 'success' THEN 1 END) * 100.0 / COUNT(qcs.id), 2)
            ELSE 0 
        END as success_rate,
        ROUND(AVG(qcs.response_time_ms), 2) as avg_scan_time
    FROM qr_codes qc
    LEFT JOIN qr_code_scans qcs ON qc.id = qcs.qr_code_id
    WHERE DATE(qc.created_at) BETWEEN start_date AND end_date
    GROUP BY DATE(qc.created_at)
    ORDER BY date;
END;
$$ LANGUAGE plpgsql;

-- Insert initial configuration data
INSERT INTO qr_code_analytics (date, qr_type, security_level) 
VALUES 
    (CURRENT_DATE, 'pickup', 'standard'),
    (CURRENT_DATE, 'pickup', 'high'),
    (CURRENT_DATE, 'pickup', 'maximum'),
    (CURRENT_DATE, 'delivery', 'standard'),
    (CURRENT_DATE, 'delivery', 'high'),
    (CURRENT_DATE, 'delivery', 'maximum')
ON CONFLICT (date, qr_type, security_level) DO NOTHING;

-- Grant permissions (adjust as needed for your environment)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO qr_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO qr_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO qr_user;