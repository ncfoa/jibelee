-- Notification Service Database Schema
-- P2P Delivery Platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE notification_category_enum AS ENUM (
    'delivery_update', 'new_request', 'payment', 'system', 'promotional', 'security'
);

CREATE TYPE template_status_enum AS ENUM ('active', 'inactive', 'draft');

CREATE TYPE notification_type_enum AS ENUM ('push', 'email', 'sms', 'in_app');

CREATE TYPE notification_status_enum AS ENUM ('sent', 'delivered', 'read', 'failed', 'bounced');

CREATE TYPE notification_priority_enum AS ENUM ('low', 'normal', 'high', 'urgent');

CREATE TYPE platform_enum AS ENUM ('ios', 'android', 'web', 'windows', 'macos', 'linux');

CREATE TYPE bulk_operation_enum AS ENUM ('send', 'cancel', 'reschedule');

CREATE TYPE bulk_status_enum AS ENUM ('processing', 'completed', 'failed', 'canceled');

-- 1. Notification Templates Table
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
    created_by UUID
);

-- 2. Notifications Table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    template_id UUID REFERENCES notification_templates(id),
    
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
    
    metadata JSONB DEFAULT '{}'
);

-- 3. Notification Preferences Table
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Device Tokens Table
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Bulk Notifications Table
CREATE TABLE bulk_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES notification_templates(id),
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
    created_by UUID
);

-- 6. Notification Webhooks Table
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

-- 7. Notification Analytics Table
CREATE TABLE notification_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_id UUID REFERENCES notifications(id),
    event_type VARCHAR(50) NOT NULL, -- sent, delivered, opened, clicked, failed
    event_data JSONB DEFAULT '{}',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Additional analytics fields
    user_agent TEXT,
    ip_address INET,
    location JSONB
);

-- 8. Email Templates Table (for rich email templates)
CREATE TABLE email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES notification_templates(id),
    name VARCHAR(255) NOT NULL,
    subject_template TEXT NOT NULL,
    html_template TEXT NOT NULL,
    text_template TEXT,
    
    -- Template metadata
    preview_text VARCHAR(255),
    from_name VARCHAR(255) DEFAULT 'P2P Delivery',
    from_email VARCHAR(255) DEFAULT 'noreply@p2pdelivery.com',
    reply_to VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Notification Queue Table (for scheduled notifications)
CREATE TABLE notification_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_data JSONB NOT NULL,
    scheduled_at TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    
    -- Error handling
    error_message TEXT,
    next_retry_at TIMESTAMP
);

-- 10. User Notification Settings (extended preferences)
CREATE TABLE user_notification_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSONB NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, setting_key)
);

-- Create indexes for performance optimization

-- Notification indexes
CREATE INDEX idx_notifications_user_status ON notifications(user_id, status, sent_at);
CREATE INDEX idx_notifications_type_category ON notifications(notification_type, category);
CREATE INDEX idx_notifications_external_id ON notifications(external_id);
CREATE INDEX idx_notifications_delivery_trip ON notifications(delivery_id, trip_id);
CREATE INDEX idx_notifications_sent_at ON notifications(sent_at);

-- Template indexes
CREATE INDEX idx_templates_category_status ON notification_templates(category, status);
CREATE INDEX idx_templates_name ON notification_templates(name);

-- Preference indexes
CREATE INDEX idx_preferences_user_id ON notification_preferences(user_id);

-- Device token indexes
CREATE INDEX idx_device_tokens_user_active ON device_tokens(user_id, active) WHERE active = true;
CREATE INDEX idx_device_tokens_platform ON device_tokens(platform);
CREATE INDEX idx_device_tokens_token ON device_tokens(token);

-- Analytics indexes
CREATE INDEX idx_notifications_analytics ON notifications(sent_at, notification_type, status);
CREATE INDEX idx_notifications_engagement ON notifications(user_id, read_at, clicked_at);
CREATE INDEX idx_analytics_notification_id ON notification_analytics(notification_id);
CREATE INDEX idx_analytics_event_type ON notification_analytics(event_type, timestamp);

-- Webhook indexes
CREATE INDEX idx_webhooks_active ON notification_webhooks(active) WHERE active = true;
CREATE INDEX idx_webhooks_events ON notification_webhooks USING GIN(events);

-- Queue indexes
CREATE INDEX idx_queue_scheduled ON notification_queue(scheduled_at, status);
CREATE INDEX idx_queue_status ON notification_queue(status);

-- Bulk notification indexes
CREATE INDEX idx_bulk_notifications_status ON bulk_notifications(status);
CREATE INDEX idx_bulk_notifications_created_at ON bulk_notifications(created_at);

-- Email template indexes
CREATE INDEX idx_email_templates_template_id ON email_templates(template_id);

-- User settings indexes
CREATE INDEX idx_user_settings_user_id ON user_notification_settings(user_id);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables
CREATE TRIGGER update_notification_templates_updated_at BEFORE UPDATE ON notification_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_device_tokens_updated_at BEFORE UPDATE ON device_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notification_webhooks_updated_at BEFORE UPDATE ON notification_webhooks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_notification_settings_updated_at BEFORE UPDATE ON user_notification_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default notification templates
INSERT INTO notification_templates (name, description, category, push_template, email_template, sms_template, in_app_template, variables) VALUES
('delivery_picked_up', 'Notification when delivery is picked up', 'delivery_update', 
 '{"title": "📦 Package Picked Up", "body": "{{travelerName}} has picked up your package for delivery to {{deliveryAddress}}", "icon": "pickup_icon", "sound": "default", "clickAction": "DELIVERY_TRACKING", "data": {"deliveryId": "{{deliveryId}}", "type": "pickup_confirmation"}}',
 '{"subject": "Your package has been picked up - {{deliveryNumber}}", "htmlBody": "<h2>Great news!</h2><p>{{travelerName}} has picked up your package and is on the way to {{deliveryAddress}}.</p>", "textBody": "Your package {{deliveryNumber}} has been picked up by {{travelerName}} and is on the way to {{deliveryAddress}}."}',
 '{"body": "📦 Your package {{deliveryNumber}} has been picked up by {{travelerName}}. Track: {{trackingUrl}}"}',
 '{"title": "Package Picked Up", "message": "{{travelerName}} has your package and is on the way!", "actionButton": {"text": "Track Delivery", "action": "OPEN_TRACKING", "data": {"deliveryId": "{{deliveryId}}"}}}',
 '[{"name": "travelerName", "type": "string", "required": true}, {"name": "deliveryAddress", "type": "string", "required": true}, {"name": "deliveryNumber", "type": "string", "required": true}, {"name": "deliveryId", "type": "uuid", "required": true}, {"name": "trackingUrl", "type": "url", "required": false}]'
),
('delivery_completed', 'Notification when delivery is completed', 'delivery_update',
 '{"title": "✅ Delivery Completed", "body": "Your {{itemName}} has been successfully delivered to {{deliveryAddress}}", "icon": "completed_icon", "sound": "success", "clickAction": "DELIVERY_DETAILS", "data": {"deliveryId": "{{deliveryId}}", "type": "delivery_completed"}}',
 '{"subject": "Delivery completed - {{deliveryNumber}}", "htmlBody": "<h2>Delivery Successful!</h2><p>Your {{itemName}} has been delivered to {{deliveryAddress}}. Please rate your experience.</p>", "textBody": "Your {{itemName}} has been successfully delivered to {{deliveryAddress}}. Delivery ID: {{deliveryNumber}}"}',
 '{"body": "✅ Your {{itemName}} has been delivered! Rate your experience: {{ratingUrl}}"}',
 '{"title": "Delivery Completed", "message": "Your {{itemName}} has been delivered successfully!", "actionButton": {"text": "Rate Experience", "action": "OPEN_RATING", "data": {"deliveryId": "{{deliveryId}}"}}}',
 '[{"name": "itemName", "type": "string", "required": true}, {"name": "deliveryAddress", "type": "string", "required": true}, {"name": "deliveryNumber", "type": "string", "required": true}, {"name": "deliveryId", "type": "uuid", "required": true}, {"name": "ratingUrl", "type": "url", "required": false}]'
),
('new_delivery_request', 'Notification for new delivery request', 'new_request',
 '{"title": "🚀 New Delivery Opportunity", "body": "New delivery request from {{originCity}} to {{destinationCity}} - {{estimatedEarnings}}", "icon": "request_icon", "sound": "notification", "clickAction": "VIEW_REQUEST", "data": {"requestId": "{{requestId}}", "type": "new_request"}}',
 '{"subject": "New delivery opportunity - {{estimatedEarnings}}", "htmlBody": "<h2>New Delivery Request</h2><p>A new delivery request is available from {{originCity}} to {{destinationCity}}. Estimated earnings: {{estimatedEarnings}}</p>", "textBody": "New delivery request from {{originCity}} to {{destinationCity}}. Estimated earnings: {{estimatedEarnings}}. Request ID: {{requestId}}"}',
 '{"body": "🚀 New delivery: {{originCity}} → {{destinationCity}} ({{estimatedEarnings}}). View: {{requestUrl}}"}',
 '{"title": "New Delivery Request", "message": "{{originCity}} → {{destinationCity}} for {{estimatedEarnings}}", "actionButton": {"text": "View Request", "action": "OPEN_REQUEST", "data": {"requestId": "{{requestId}}"}}}',
 '[{"name": "originCity", "type": "string", "required": true}, {"name": "destinationCity", "type": "string", "required": true}, {"name": "estimatedEarnings", "type": "string", "required": true}, {"name": "requestId", "type": "uuid", "required": true}, {"name": "requestUrl", "type": "url", "required": false}]'
);

-- Insert default user preferences for system user (can be used as template)
INSERT INTO notification_preferences (user_id, push_enabled, email_enabled, sms_enabled, in_app_enabled) VALUES
('00000000-0000-0000-0000-000000000000', true, true, false, true);

-- Create a function to initialize user preferences
CREATE OR REPLACE FUNCTION initialize_user_preferences(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO notification_preferences (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust as needed for your user)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO notification_service_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO notification_service_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO notification_service_user;