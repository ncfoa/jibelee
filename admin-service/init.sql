-- Admin Service Database Initialization Script
-- This script sets up the PostgreSQL database for the admin service

-- Create database (if it doesn't exist)
-- Note: This should be run by a user with database creation privileges

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create custom types/enums
DO $$ BEGIN
    -- Admin role enum
    CREATE TYPE admin_role_enum AS ENUM (
        'super_admin', 'admin', 'moderator', 'support', 'finance', 'analyst'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    -- Dispute category enum
    CREATE TYPE dispute_category_enum AS ENUM (
        'item_not_delivered', 'item_damaged', 'service_not_as_described', 
        'unauthorized_charge', 'payment_issue', 'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    -- Dispute priority enum
    CREATE TYPE dispute_priority_enum AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    -- Dispute status enum
    CREATE TYPE dispute_status_enum AS ENUM (
        'open', 'under_review', 'awaiting_response', 'resolved', 'escalated', 'closed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    -- Dispute resolution enum
    CREATE TYPE dispute_resolution_enum AS ENUM (
        'full_refund', 'partial_refund', 'replacement', 'compensation', 'no_action'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    -- Evidence type enum
    CREATE TYPE evidence_type_enum AS ENUM ('photo', 'video', 'document', 'audio', 'text');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    -- Backup type enum
    CREATE TYPE backup_type_enum AS ENUM ('full', 'incremental', 'database_only', 'files_only');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    -- Backup scope enum
    CREATE TYPE backup_scope_enum AS ENUM ('system', 'database', 'files', 'logs', 'configuration');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    -- Backup status enum
    CREATE TYPE backup_status_enum AS ENUM ('in_progress', 'completed', 'failed', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    -- Activity severity enum
    CREATE TYPE activity_severity_enum AS ENUM ('info', 'warning', 'error', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    -- Export format enum
    CREATE TYPE export_format_enum AS ENUM ('csv', 'json', 'xlsx', 'xml');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    -- Export status enum
    CREATE TYPE export_status_enum AS ENUM ('processing', 'completed', 'failed', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    -- Data type enum for system configuration
    CREATE TYPE config_data_type_enum AS ENUM ('string', 'number', 'boolean', 'object', 'array');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    -- Message type enum
    CREATE TYPE message_type_enum AS ENUM ('text', 'system', 'notification', 'update');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    -- Sender type enum
    CREATE TYPE sender_type_enum AS ENUM ('user', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    -- Compression type enum
    CREATE TYPE compression_type_enum AS ENUM ('zip', 'gzip', 'tar', 'none');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create functions for updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create function to generate case numbers
CREATE OR REPLACE FUNCTION generate_case_number()
RETURNS TEXT AS $$
DECLARE
    year_part TEXT;
    sequence_num INTEGER;
    case_number TEXT;
BEGIN
    year_part := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
    
    -- Get the next sequence number for this year
    SELECT COALESCE(MAX(CAST(SUBSTRING(case_number FROM 'DISP-' || year_part || '-(.*)') AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM disputes
    WHERE case_number LIKE 'DISP-' || year_part || '-%';
    
    -- Format the case number
    case_number := 'DISP-' || year_part || '-' || LPAD(sequence_num::TEXT, 6, '0');
    
    RETURN case_number;
END;
$$ LANGUAGE plpgsql;

-- Create audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO admin_activity_log (
            admin_id, action, resource_type, resource_id, description, details, created_at
        ) VALUES (
            COALESCE(NEW.updated_by, NEW.created_by), 
            TG_OP, 
            TG_TABLE_NAME, 
            NEW.id, 
            'Record created', 
            row_to_json(NEW), 
            CURRENT_TIMESTAMP
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO admin_activity_log (
            admin_id, action, resource_type, resource_id, description, details, created_at
        ) VALUES (
            COALESCE(NEW.updated_by, NEW.created_by), 
            TG_OP, 
            TG_TABLE_NAME, 
            NEW.id, 
            'Record updated', 
            jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW)), 
            CURRENT_TIMESTAMP
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO admin_activity_log (
            admin_id, action, resource_type, resource_id, description, details, created_at
        ) VALUES (
            OLD.updated_by, 
            TG_OP, 
            TG_TABLE_NAME, 
            OLD.id, 
            'Record deleted', 
            row_to_json(OLD), 
            CURRENT_TIMESTAMP
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create performance monitoring views
CREATE OR REPLACE VIEW admin_dashboard_summary AS
SELECT 
    (SELECT COUNT(*) FROM admin_users WHERE is_active = true) as active_admins,
    (SELECT COUNT(*) FROM disputes WHERE status IN ('open', 'under_review')) as open_disputes,
    (SELECT COUNT(*) FROM system_backups WHERE status = 'completed' AND created_at >= CURRENT_DATE - INTERVAL '7 days') as recent_backups,
    (SELECT COUNT(*) FROM data_exports WHERE status = 'processing') as active_exports,
    (SELECT COUNT(*) FROM admin_activity_log WHERE created_at >= CURRENT_DATE) as todays_activities;

-- Create dispute summary view
CREATE OR REPLACE VIEW dispute_summary AS
SELECT 
    status,
    COUNT(*) as count,
    AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_at, CURRENT_TIMESTAMP) - created_at))/3600) as avg_hours_to_resolve
FROM disputes
GROUP BY status;

-- Create system health view
CREATE OR REPLACE VIEW system_health AS
SELECT 
    'database' as component,
    'healthy' as status,
    jsonb_build_object(
        'connections', (SELECT count(*) FROM pg_stat_activity),
        'database_size', pg_size_pretty(pg_database_size(current_database())),
        'last_backup', (SELECT MAX(completed_at) FROM system_backups WHERE status = 'completed')
    ) as details;

-- Grant necessary permissions
-- Note: Adjust these based on your specific user setup
GRANT USAGE ON SCHEMA public TO admin_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO admin_user;

-- Create indexes for better performance (these will also be created by Sequelize)
-- But having them here ensures they exist even if Sequelize doesn't create them

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_dispute_description_fts ON disputes USING gin(to_tsvector('english', description));
CREATE INDEX IF NOT EXISTS idx_dispute_resolution_notes_fts ON disputes USING gin(to_tsvector('english', resolution_notes));
CREATE INDEX IF NOT EXISTS idx_admin_activity_description_fts ON admin_activity_log USING gin(to_tsvector('english', description));

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_disputes_status_priority_date ON disputes(status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_admin_date ON admin_activity_log(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_config_category_key ON system_configuration(category, key) WHERE is_active = true;

-- Partial indexes for active records
CREATE INDEX IF NOT EXISTS idx_active_admin_users ON admin_users(role, created_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_active_disputes ON disputes(status, assignee_id, created_at) WHERE status != 'closed';
CREATE INDEX IF NOT EXISTS idx_unread_messages ON dispute_messages(dispute_id, created_at) WHERE is_read = false AND is_deleted = false;

-- JSONB indexes for metadata searches
CREATE INDEX IF NOT EXISTS idx_admin_activity_details ON admin_activity_log USING gin(details);
CREATE INDEX IF NOT EXISTS idx_system_config_value ON system_configuration USING gin(value);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_additional ON daily_metrics USING gin(additional_metrics);

-- Comments for documentation
COMMENT ON DATABASE admin_db IS 'Admin service database for P2P Delivery Platform';

-- Table comments
COMMENT ON TABLE admin_users IS 'Admin users with roles and permissions';
COMMENT ON TABLE admin_activity_log IS 'Audit log of all admin activities';
COMMENT ON TABLE system_configuration IS 'System-wide configuration settings';
COMMENT ON TABLE disputes IS 'Customer disputes and their resolution';
COMMENT ON TABLE dispute_evidence IS 'Evidence files attached to disputes';
COMMENT ON TABLE dispute_messages IS 'Messages and communications within disputes';
COMMENT ON TABLE system_backups IS 'System backup records and metadata';
COMMENT ON TABLE data_exports IS 'Data export jobs and their status';
COMMENT ON TABLE daily_metrics IS 'Daily aggregated metrics for analytics';

-- Create notification function for real-time updates
CREATE OR REPLACE FUNCTION notify_admin_activity()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('admin_activity', json_build_object(
        'action', NEW.action,
        'resource_type', NEW.resource_type,
        'resource_id', NEW.resource_id,
        'admin_id', NEW.admin_id,
        'timestamp', NEW.created_at
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for real-time notifications
DROP TRIGGER IF EXISTS admin_activity_notify ON admin_activity_log;
CREATE TRIGGER admin_activity_notify
    AFTER INSERT ON admin_activity_log
    FOR EACH ROW
    EXECUTE FUNCTION notify_admin_activity();

-- Create cleanup procedures
CREATE OR REPLACE FUNCTION cleanup_old_activity_logs(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM admin_activity_log 
    WHERE created_at < CURRENT_DATE - INTERVAL '1 day' * days_to_keep
    AND severity NOT IN ('high', 'critical');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_expired_exports()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    UPDATE data_exports 
    SET status = 'expired' 
    WHERE expires_at < CURRENT_TIMESTAMP 
    AND status != 'expired';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Insert initial admin user (if needed)
-- Note: This should be customized based on your setup
INSERT INTO admin_users (id, user_id, role, permissions, is_active, created_by) 
VALUES (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000001', 
    'super_admin', 
    ARRAY['*'], 
    true, 
    '00000000-0000-0000-0000-000000000000'
) ON CONFLICT (user_id) DO NOTHING;

-- Log the initialization
INSERT INTO admin_activity_log (
    admin_id, action, resource_type, resource_id, description, details
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'database_initialized',
    'system',
    null,
    'Admin service database initialized',
    jsonb_build_object('timestamp', CURRENT_TIMESTAMP, 'version', '1.0.0')
);

-- Final message
DO $$
BEGIN
    RAISE NOTICE 'Admin service database initialization completed successfully!';
    RAISE NOTICE 'Database: %', current_database();
    RAISE NOTICE 'Timestamp: %', CURRENT_TIMESTAMP;
END $$;