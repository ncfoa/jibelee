# P2P DELIVERY PLATFORM - REMAINING DATABASE SERVICES

## Notification Service Tables

### 1. Notification Templates Table
**Purpose**: Reusable notification templates for all channels  
**Database**: notification_db  
**Estimated Size**: ~100MB (10K templates)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique template identifier |
| name | VARCHAR(255) | UNIQUE NOT NULL | Template name |
| description | TEXT | | Template description |
| category | notification_category_enum | NOT NULL | Notification category |
| subcategory | VARCHAR(100) | | Specific subcategory |
| push_template | JSONB | | Push notification template |
| email_template | JSONB | | Email template |
| sms_template | JSONB | | SMS template |
| in_app_template | JSONB | | In-app notification template |
| webhook_template | JSONB | | Webhook payload template |
| variables | JSONB | DEFAULT '[]' | Template variable definitions |
| targeting | JSONB | DEFAULT '{}' | Targeting conditions |
| personalization_rules | JSONB | DEFAULT '{}' | Personalization logic |
| a_b_test_config | JSONB | | A/B testing configuration |
| status | template_status_enum | NOT NULL, DEFAULT 'active' | Template status |
| version | INTEGER | DEFAULT 1 | Template version |
| language | VARCHAR(10) | DEFAULT 'en' | Template language |
| priority | notification_priority_enum | DEFAULT 'normal' | Default priority |
| rate_limit | INTEGER | DEFAULT 0 | Rate limiting (per hour) |
| delivery_window | JSONB | | Delivery time windows |
| expiry_rules | JSONB | | Message expiry rules |
| retry_policy | JSONB | | Retry configuration |
| compliance_flags | JSONB | DEFAULT '{}' | Compliance requirements |
| analytics_config | JSONB | DEFAULT '{}' | Analytics tracking |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Template creation time |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |
| created_by | UUID | FK → users(id) | Template creator |

**Indexes:**
- `idx_notification_templates_name` ON (name)
- `idx_notification_templates_category` ON (category)
- `idx_notification_templates_status` ON (status)
- `idx_notification_templates_language` ON (language)
- `idx_notification_templates_priority` ON (priority)
- `idx_notification_templates_created_by` ON (created_by)

**Business Rules:**
- Templates support multiple languages
- A/B testing for optimization
- Rate limiting prevents spam
- Compliance tracking for regulations

### 2. Notifications Table
**Purpose**: Individual notification records and delivery tracking  
**Database**: notification_db  
**Estimated Size**: ~8GB (50M notifications)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique notification identifier |
| user_id | UUID | NOT NULL, FK → users(id) ON DELETE CASCADE | Notification recipient |
| template_id | UUID | FK → notification_templates(id) | Template used |
| notification_type | notification_type_enum | NOT NULL | Notification channel type |
| category | notification_category_enum | NOT NULL | Notification category |
| title | VARCHAR(255) | NOT NULL | Notification title |
| message | TEXT | NOT NULL | Notification message |
| rich_content | JSONB | | Rich content (images, buttons) |
| push_data | JSONB | | Push-specific data |
| email_data | JSONB | | Email-specific data |
| sms_data | JSONB | | SMS-specific data |
| in_app_data | JSONB | | In-app-specific data |
| webhook_data | JSONB | | Webhook payload |
| status | notification_status_enum | NOT NULL, DEFAULT 'sent' | Delivery status |
| priority | notification_priority_enum | NOT NULL, DEFAULT 'normal' | Notification priority |
| scheduled_for | TIMESTAMP | | Scheduled delivery time |
| sent_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Send timestamp |
| delivered_at | TIMESTAMP | | Delivery confirmation time |
| read_at | TIMESTAMP | | Read timestamp |
| clicked_at | TIMESTAMP | | Click timestamp |
| dismissed_at | TIMESTAMP | | Dismissal timestamp |
| external_id | VARCHAR(255) | | Provider-specific ID |
| provider_response | JSONB | | Provider response data |
| failure_reason | TEXT | | Delivery failure reason |
| retry_count | INTEGER | DEFAULT 0 | Number of retry attempts |
| max_retries | INTEGER | DEFAULT 3 | Maximum retry attempts |
| expires_at | TIMESTAMP | | Message expiration time |
| delivery_id | UUID | FK → deliveries(id) | Associated delivery |
| trip_id | UUID | FK → trips(id) | Associated trip |
| campaign_id | UUID | | Marketing campaign ID |
| ab_test_variant | VARCHAR(50) | | A/B test variant |
| personalization_data | JSONB | | Personalization context |
| tracking_data | JSONB | | Analytics tracking data |
| metadata | JSONB | DEFAULT '{}' | Additional metadata |

**Indexes:**
- `idx_notifications_user_id` ON (user_id)
- `idx_notifications_template_id` ON (template_id)
- `idx_notifications_type` ON (notification_type)
- `idx_notifications_category` ON (category)
- `idx_notifications_status` ON (status)
- `idx_notifications_priority` ON (priority)
- `idx_notifications_sent_at` ON (sent_at)
- `idx_notifications_delivery_id` ON (delivery_id)
- `idx_notifications_unread` ON (user_id, read_at) WHERE read_at IS NULL
- `idx_notifications_scheduled` ON (scheduled_for) WHERE status = 'scheduled'

**Business Rules:**
- Automatic retry for failed deliveries
- Read receipts for engagement tracking
- Expiration prevents outdated notifications
- Campaign tracking for analytics

### 3. Notification Preferences Table
**Purpose**: User notification preferences and opt-out management  
**Database**: notification_db  
**Estimated Size**: ~200MB (1M preference sets)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique preferences identifier |
| user_id | UUID | NOT NULL UNIQUE, FK → users(id) ON DELETE CASCADE | Preferences owner |
| push_enabled | BOOLEAN | DEFAULT TRUE | Push notifications enabled |
| push_categories | JSONB | DEFAULT '{}' | Push category preferences |
| push_quiet_hours | JSONB | | Quiet hours configuration |
| push_device_tokens | JSONB | DEFAULT '[]' | Device token management |
| email_enabled | BOOLEAN | DEFAULT TRUE | Email notifications enabled |
| email_categories | JSONB | DEFAULT '{}' | Email category preferences |
| email_frequency | VARCHAR(20) | DEFAULT 'immediate' | Email frequency setting |
| email_digest_enabled | BOOLEAN | DEFAULT FALSE | Digest email enabled |
| email_unsubscribe_token | VARCHAR(255) | UNIQUE | Unsubscribe token |
| sms_enabled | BOOLEAN | DEFAULT FALSE | SMS notifications enabled |
| sms_categories | JSONB | DEFAULT '{}' | SMS category preferences |
| sms_phone_number | VARCHAR(20) | | SMS phone number |
| sms_verified | BOOLEAN | DEFAULT FALSE | SMS number verified |
| in_app_enabled | BOOLEAN | DEFAULT TRUE | In-app notifications enabled |
| in_app_categories | JSONB | DEFAULT '{}' | In-app category preferences |
| webhook_enabled | BOOLEAN | DEFAULT FALSE | Webhook notifications enabled |
| webhook_url | VARCHAR(500) | | Webhook endpoint URL |
| webhook_secret | VARCHAR(255) | | Webhook secret key |
| language | VARCHAR(10) | DEFAULT 'en' | Preferred language |
| timezone | VARCHAR(50) | DEFAULT 'UTC' | User timezone |
| marketing_enabled | BOOLEAN | DEFAULT FALSE | Marketing communications |
| promotional_enabled | BOOLEAN | DEFAULT FALSE | Promotional notifications |
| research_enabled | BOOLEAN | DEFAULT FALSE | Research participation |
| do_not_disturb_enabled | BOOLEAN | DEFAULT FALSE | Do not disturb mode |
| do_not_disturb_schedule | JSONB | | DND schedule configuration |
| accessibility_preferences | JSONB | DEFAULT '{}' | Accessibility settings |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Preferences creation time |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |

**Indexes:**
- `idx_notification_preferences_user_id` ON (user_id)
- `idx_notification_preferences_email_token` ON (email_unsubscribe_token)
- `idx_notification_preferences_sms_phone` ON (sms_phone_number)
- `idx_notification_preferences_language` ON (language)
- `idx_notification_preferences_marketing` ON (marketing_enabled)

**Business Rules:**
- Granular control over notification categories
- Compliance with privacy regulations
- Unsubscribe tokens for email compliance
- Do not disturb scheduling

### 4. Device Tokens Table
**Purpose**: Push notification device token management  
**Database**: notification_db  
**Estimated Size**: ~300MB (2M device tokens)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique token identifier |
| user_id | UUID | NOT NULL, FK → users(id) ON DELETE CASCADE | Token owner |
| token | VARCHAR(500) | NOT NULL | Push notification token |
| platform | platform_enum | NOT NULL | Device platform |
| device_id | VARCHAR(255) | | Unique device identifier |
| device_name | VARCHAR(255) | | User-defined device name |
| app_version | VARCHAR(20) | | Application version |
| os_version | VARCHAR(50) | | Operating system version |
| device_model | VARCHAR(100) | | Device model |
| active | BOOLEAN | DEFAULT TRUE | Token active status |
| verified | BOOLEAN | DEFAULT FALSE | Token verification status |
| last_used_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last successful use |
| failure_count | INTEGER | DEFAULT 0 | Consecutive failure count |
| last_failure_at | TIMESTAMP | | Last failure timestamp |
| failure_reason | TEXT | | Last failure reason |
| registration_source | VARCHAR(50) | | Token registration source |
| environment | VARCHAR(20) | DEFAULT 'production' | Environment (prod/dev) |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Token creation time |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |
| expires_at | TIMESTAMP | | Token expiration time |

**Indexes:**
- `idx_device_tokens_user_id` ON (user_id)
- `idx_device_tokens_token` ON (token)
- `idx_device_tokens_platform` ON (platform)
- `idx_device_tokens_device_id` ON (device_id)
- `idx_device_tokens_active` ON (user_id) WHERE active = true
- `idx_device_tokens_last_used` ON (last_used_at)

**Business Rules:**
- Automatic cleanup of inactive tokens
- Failure tracking for token validation
- Platform-specific token handling
- Environment separation for testing

---

## QR Code Service Tables

### 1. QR Codes Table
**Purpose**: QR code generation and management for delivery verification  
**Database**: qr_db  
**Estimated Size**: ~500MB (2M QR codes)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique QR code identifier |
| delivery_id | UUID | NOT NULL, FK → deliveries(id) ON DELETE CASCADE | Associated delivery |
| qr_type | qr_type_enum | NOT NULL | QR code type |
| code_data | TEXT | NOT NULL | QR code content data |
| encrypted_data | TEXT | NOT NULL | Encrypted verification data |
| hash_value | VARCHAR(64) | UNIQUE NOT NULL | SHA-256 hash of code |
| image_data | TEXT | | Base64 encoded QR image |
| image_url | VARCHAR(500) | | QR code image URL |
| download_url | VARCHAR(500) | | Download link |
| backup_code | VARCHAR(50) | NOT NULL | Manual backup code |
| security_level | security_level_enum | NOT NULL, DEFAULT 'standard' | Security level |
| encryption_algorithm | VARCHAR(50) | DEFAULT 'AES-256' | Encryption method |
| security_features | JSONB | DEFAULT '{}' | Additional security features |
| format | VARCHAR(20) | DEFAULT 'PNG' | Image format |
| size | VARCHAR(20) | DEFAULT '256x256' | Image dimensions |
| error_correction | VARCHAR(10) | DEFAULT 'M' | Error correction level |
| expires_at | TIMESTAMP | NOT NULL | QR code expiration |
| used_at | TIMESTAMP | | Usage timestamp |
| status | qr_status_enum | NOT NULL, DEFAULT 'active' | QR code status |
| usage_count | INTEGER | DEFAULT 0 | Number of scans |
| max_usage_count | INTEGER | DEFAULT 1 | Maximum allowed scans |
| location_bound | BOOLEAN | DEFAULT FALSE | Location binding enabled |
| bound_coordinates | GEOGRAPHY(POINT, 4326) | | Bound GPS coordinates |
| bound_radius | INTEGER | | Binding radius in meters |
| time_bound | BOOLEAN | DEFAULT FALSE | Time binding enabled |
| valid_from | TIMESTAMP | | Validity start time |
| valid_until | TIMESTAMP | | Validity end time |
| device_bound | BOOLEAN | DEFAULT FALSE | Device binding enabled |
| bound_device_id | VARCHAR(255) | | Bound device identifier |
| ip_restrictions | INET[] | | Allowed IP addresses |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | QR creation time |
| revoked_at | TIMESTAMP | | Revocation timestamp |
| revoked_reason | TEXT | | Revocation reason |
| revoked_by | UUID | FK → users(id) | Revocation initiator |

**Indexes:**
- `idx_qr_codes_delivery_id` ON (delivery_id)
- `idx_qr_codes_hash` ON (hash_value)
- `idx_qr_codes_type` ON (qr_type)
- `idx_qr_codes_status` ON (status)
- `idx_qr_codes_expires_at` ON (expires_at)
- `idx_qr_codes_backup_code` ON (backup_code)
- `idx_qr_codes_bound_coordinates` ON GIST(bound_coordinates)
- `idx_qr_codes_active` ON (status, expires_at) WHERE status = 'active'

**Business Rules:**
- QR codes expire automatically for security
- Location binding prevents misuse
- Multiple security levels supported
- Backup codes for manual verification

### 2. QR Code Scans Table
**Purpose**: QR code scan attempts and verification history  
**Database**: qr_db  
**Estimated Size**: ~1GB (5M scans)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique scan identifier |
| qr_code_id | UUID | NOT NULL, FK → qr_codes(id) ON DELETE CASCADE | Scanned QR code |
| scanned_by | UUID | NOT NULL, FK → users(id) | Scanner user |
| scan_result | scan_result_enum | NOT NULL | Scan result |
| verification_status | verification_status_enum | NOT NULL | Verification outcome |
| scan_location | GEOGRAPHY(POINT, 4326) | | Scan GPS coordinates |
| scan_accuracy | DECIMAL(8,2) | | Location accuracy |
| ip_address | INET | | Scanner IP address |
| user_agent | TEXT | | Scanner user agent |
| device_info | JSONB | | Scanner device information |
| app_version | VARCHAR(20) | | App version used |
| camera_used | BOOLEAN | DEFAULT TRUE | Camera scan vs manual |
| scan_duration | INTEGER | | Scan duration in milliseconds |
| image_quality_score | DECIMAL(3,2) | | Scanned image quality |
| additional_verification | JSONB | | Extra verification data |
| biometric_verification | JSONB | | Biometric verification data |
| two_factor_verification | JSONB | | 2FA verification data |
| failure_reason | TEXT | | Scan failure reason |
| security_warnings | TEXT[] | | Security warnings |
| fraud_indicators | JSONB | | Fraud detection data |
| risk_score | INTEGER | DEFAULT 0 | Calculated risk score |
| manual_override | BOOLEAN | DEFAULT FALSE | Manual override applied |
| override_reason | TEXT | | Override justification |
| override_by | UUID | FK → users(id) | Override authorizer |
| scanned_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Scan timestamp |
| processed_at | TIMESTAMP | | Processing completion time |

**Indexes:**
- `idx_qr_code_scans_qr_code_id` ON (qr_code_id)
- `idx_qr_code_scans_scanned_by` ON (scanned_by)
- `idx_qr_code_scans_result` ON (scan_result)
- `idx_qr_code_scans_verification_status` ON (verification_status)
- `idx_qr_code_scans_location` ON GIST(scan_location)
- `idx_qr_code_scans_scanned_at` ON (scanned_at)
- `idx_qr_code_scans_risk_score` ON (risk_score DESC)
- `idx_qr_code_scans_failed` ON (scan_result, failure_reason) WHERE scan_result = 'failed'

**Business Rules:**
- All scan attempts logged for security
- Location verification prevents fraud
- Risk scoring for anomaly detection
- Manual override capability for exceptions

### 3. QR Emergency Overrides Table
**Purpose**: Emergency QR code bypass and alternative verification  
**Database**: qr_db  
**Estimated Size**: ~20MB (10K overrides)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique override identifier |
| delivery_id | UUID | NOT NULL, FK → deliveries(id) ON DELETE CASCADE | Associated delivery |
| qr_code_id | UUID | FK → qr_codes(id) | Original QR code |
| override_type | override_type_enum | NOT NULL | Override type |
| override_reason | TEXT | NOT NULL | Override justification |
| emergency_category | emergency_category_enum | NOT NULL | Emergency category |
| severity_level | emergency_severity_enum | NOT NULL | Severity assessment |
| alternative_verification | JSONB | | Alternative verification method |
| requested_by | UUID | NOT NULL, FK → users(id) | Override requester |
| approved_by | UUID | FK → users(id) | Override approver |
| emergency_contact | VARCHAR(20) | | Emergency contact number |
| location_data | JSONB | | Override location data |
| supporting_evidence | TEXT[] | | Evidence file URLs |
| witness_information | JSONB | | Witness details |
| police_report_number | VARCHAR(100) | | Police report reference |
| insurance_claim_number | VARCHAR(100) | | Insurance claim reference |
| alternative_code | VARCHAR(50) | NOT NULL | Alternative verification code |
| code_expires_at | TIMESTAMP | NOT NULL | Alternative code expiration |
| valid_until | TIMESTAMP | NOT NULL | Override validity period |
| used_at | TIMESTAMP | | Override usage timestamp |
| usage_location | GEOGRAPHY(POINT, 4326) | | Usage location |
| used_by | UUID | FK → users(id) | Override user |
| verification_photos | TEXT[] | | Verification photo URLs |
| admin_notes | TEXT | | Administrative notes |
| follow_up_required | BOOLEAN | DEFAULT FALSE | Follow-up action needed |
| audit_trail | JSONB | DEFAULT '[]' | Audit trail data |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Override creation time |
| approved_at | TIMESTAMP | | Approval timestamp |
| rejected_at | TIMESTAMP | | Rejection timestamp |
| rejection_reason | TEXT | | Rejection justification |

**Indexes:**
- `idx_qr_emergency_overrides_delivery_id` ON (delivery_id)
- `idx_qr_emergency_overrides_qr_code_id` ON (qr_code_id)
- `idx_qr_emergency_overrides_requested_by` ON (requested_by)
- `idx_qr_emergency_overrides_approved_by` ON (approved_by)
- `idx_qr_emergency_overrides_alternative_code` ON (alternative_code)
- `idx_qr_emergency_overrides_emergency_category` ON (emergency_category)
- `idx_qr_emergency_overrides_severity` ON (severity_level)
- `idx_qr_emergency_overrides_created_at` ON (created_at)

**Business Rules:**
- Emergency overrides require approval
- Time-limited alternative codes
- Comprehensive audit trail
- Integration with emergency services

---

## Admin Service Tables

### 1. Admin Users Table
**Purpose**: Administrative user management and role assignment  
**Database**: admin_db  
**Estimated Size**: ~10MB (1K admin users)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique admin identifier |
| user_id | UUID | NOT NULL UNIQUE, FK → users(id) ON DELETE CASCADE | Admin user reference |
| role | admin_role_enum | NOT NULL | Administrative role |
| department | VARCHAR(100) | | Department assignment |
| permissions | TEXT[] | DEFAULT '{}' | Specific permissions |
| access_level | INTEGER | NOT NULL, DEFAULT 1 | Access level (1-10) |
| regions_managed | TEXT[] | | Geographic regions |
| categories_managed | TEXT[] | | Service categories |
| is_active | BOOLEAN | DEFAULT TRUE | Admin active status |
| is_super_admin | BOOLEAN | DEFAULT FALSE | Super admin flag |
| can_approve_overrides | BOOLEAN | DEFAULT FALSE | Override approval permission |
| can_access_financials | BOOLEAN | DEFAULT FALSE | Financial data access |
| can_manage_users | BOOLEAN | DEFAULT FALSE | User management permission |
| can_view_analytics | BOOLEAN | DEFAULT FALSE | Analytics access |
| can_export_data | BOOLEAN | DEFAULT FALSE | Data export permission |
| emergency_contact | VARCHAR(20) | | Emergency contact number |
| backup_contact | VARCHAR(20) | | Backup contact number |
| security_clearance | VARCHAR(50) | | Security clearance level |
| last_login_at | TIMESTAMP | | Last login timestamp |
| last_activity_at | TIMESTAMP | | Last activity timestamp |
| failed_login_attempts | INTEGER | DEFAULT 0 | Failed login counter |
| account_locked_until | TIMESTAMP | | Account lockout expiration |
| password_expires_at | TIMESTAMP | | Password expiration |
| two_factor_required | BOOLEAN | DEFAULT TRUE | 2FA requirement |
| ip_whitelist | INET[] | | Allowed IP addresses |
| session_timeout_minutes | INTEGER | DEFAULT 60 | Session timeout |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Admin creation time |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |
| created_by | UUID | FK → users(id) | Admin creator |
| deactivated_at | TIMESTAMP | | Deactivation timestamp |
| deactivated_by | UUID | FK → users(id) | Deactivation initiator |

**Indexes:**
- `idx_admin_users_user_id` ON (user_id)
- `idx_admin_users_role` ON (role)
- `idx_admin_users_is_active` ON (is_active)
- `idx_admin_users_department` ON (department)
- `idx_admin_users_access_level` ON (access_level)
- `idx_admin_users_last_login` ON (last_login_at)
- `idx_admin_users_created_by` ON (created_by)

**Business Rules:**
- Role-based access control (RBAC)
- Multi-factor authentication required
- IP whitelisting for security
- Regular access reviews required

### 2. Admin Activity Log Table
**Purpose**: Comprehensive audit trail for administrative actions  
**Database**: admin_db  
**Estimated Size**: ~2GB (10M activities)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique activity identifier |
| admin_id | UUID | NOT NULL, FK → admin_users(user_id) | Admin user |
| session_id | UUID | | Admin session identifier |
| action | VARCHAR(100) | NOT NULL | Action performed |
| action_category | VARCHAR(50) | NOT NULL | Action category |
| resource_type | VARCHAR(50) | NOT NULL | Target resource type |
| resource_id | UUID | | Target resource ID |
| resource_identifier | VARCHAR(255) | | Human-readable resource ID |
| old_values | JSONB | | Previous values |
| new_values | JSONB | | Updated values |
| changes_summary | TEXT | | Summary of changes |
| description | TEXT | NOT NULL | Action description |
| details | JSONB | DEFAULT '{}' | Additional details |
| severity | activity_severity_enum | NOT NULL, DEFAULT 'info' | Activity severity |
| risk_level | INTEGER | DEFAULT 0 | Risk assessment score |
| compliance_flags | JSONB | DEFAULT '{}' | Compliance indicators |
| ip_address | INET | | Source IP address |
| user_agent | TEXT | | User agent string |
| location_data | JSONB | | Geographic location |
| device_fingerprint | VARCHAR(255) | | Device fingerprint |
| api_endpoint | VARCHAR(255) | | API endpoint used |
| request_method | VARCHAR(10) | | HTTP method |
| request_payload | JSONB | | Request payload |
| response_code | INTEGER | | Response status code |
| response_time_ms | INTEGER | | Response time |
| success | BOOLEAN | NOT NULL | Action success status |
| error_message | TEXT | | Error details |
| warnings | TEXT[] | | Warning messages |
| affected_users | UUID[] | | Affected user IDs |
| business_impact | TEXT | | Business impact assessment |
| regulatory_impact | TEXT | | Regulatory implications |
| approval_required | BOOLEAN | DEFAULT FALSE | Approval requirement |
| approved_by | UUID | FK → users(id) | Approver |
| approved_at | TIMESTAMP | | Approval timestamp |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Activity timestamp |

**Indexes:**
- `idx_admin_activity_log_admin_id` ON (admin_id)
- `idx_admin_activity_log_action` ON (action)
- `idx_admin_activity_log_action_category` ON (action_category)
- `idx_admin_activity_log_resource` ON (resource_type, resource_id)
- `idx_admin_activity_log_created_at` ON (created_at)
- `idx_admin_activity_log_severity` ON (severity)
- `idx_admin_activity_log_success` ON (success)
- `idx_admin_activity_log_ip_address` ON (ip_address)
- `idx_admin_activity_log_compliance` ON gin(compliance_flags)

**Business Rules:**
- Immutable audit trail
- Real-time compliance monitoring
- Risk-based alerting
- Regulatory reporting support

### 3. System Configuration Table
**Purpose**: System-wide configuration and feature flags  
**Database**: admin_db  
**Estimated Size**: ~50MB (configuration data)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique configuration identifier |
| category | VARCHAR(50) | NOT NULL | Configuration category |
| key | VARCHAR(100) | NOT NULL | Configuration key |
| value | JSONB | NOT NULL | Configuration value |
| data_type | config_data_type_enum | NOT NULL | Value data type |
| description | TEXT | | Configuration description |
| default_value | JSONB | | Default value |
| allowed_values | JSONB | | Permitted values |
| validation_rules | JSONB | | Validation constraints |
| is_sensitive | BOOLEAN | DEFAULT FALSE | Sensitive data flag |
| is_encrypted | BOOLEAN | DEFAULT FALSE | Encryption status |
| requires_restart | BOOLEAN | DEFAULT FALSE | Restart requirement |
| environment | VARCHAR(20) | DEFAULT 'production' | Target environment |
| feature_flag | BOOLEAN | DEFAULT FALSE | Feature flag indicator |
| rollout_percentage | INTEGER | DEFAULT 100 | Feature rollout percentage |
| target_users | UUID[] | | Targeted users for feature |
| target_regions | TEXT[] | | Targeted regions |
| effective_from | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Effective start time |
| effective_until | TIMESTAMP | | Effective end time |
| priority | INTEGER | DEFAULT 0 | Configuration priority |
| tags | TEXT[] | | Configuration tags |
| dependencies | TEXT[] | | Dependent configurations |
| impact_assessment | TEXT | | Change impact assessment |
| rollback_value | JSONB | | Rollback value |
| change_log | JSONB | DEFAULT '[]' | Change history |
| approval_required | BOOLEAN | DEFAULT FALSE | Approval requirement |
| approved_by | UUID | FK → users(id) | Configuration approver |
| approved_at | TIMESTAMP | | Approval timestamp |
| updated_by | UUID | NOT NULL, FK → users(id) | Last updater |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Configuration creation time |

**Indexes:**
- `idx_system_configuration_category_key` ON (category, key)
- `idx_system_configuration_category` ON (category)
- `idx_system_configuration_environment` ON (environment)
- `idx_system_configuration_feature_flag` ON (feature_flag)
- `idx_system_configuration_updated_by` ON (updated_by)
- `idx_system_configuration_effective` ON (effective_from, effective_until)
- `idx_system_configuration_tags` ON gin(tags)

**Business Rules:**
- Unique keys within categories
- Environment-specific configurations
- Feature flag rollout control
- Change approval workflows

### 4. System Backups Table
**Purpose**: Database backup tracking and management  
**Database**: admin_db  
**Estimated Size**: ~100MB (backup metadata)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique backup identifier |
| backup_type | backup_type_enum | NOT NULL | Type of backup |
| backup_scope | backup_scope_enum | NOT NULL | Backup scope |
| status | backup_status_enum | NOT NULL, DEFAULT 'in_progress' | Backup status |
| database_name | VARCHAR(100) | NOT NULL | Target database |
| backup_method | VARCHAR(50) | NOT NULL | Backup method used |
| compression_type | VARCHAR(20) | DEFAULT 'gzip' | Compression algorithm |
| encryption_enabled | BOOLEAN | DEFAULT TRUE | Encryption status |
| encryption_algorithm | VARCHAR(50) | DEFAULT 'AES-256' | Encryption method |
| size_bytes | BIGINT | | Backup size in bytes |
| compressed_size_bytes | BIGINT | | Compressed size |
| file_count | INTEGER | DEFAULT 1 | Number of backup files |
| file_path | VARCHAR(500) | | Primary backup file path |
| additional_files | TEXT[] | | Additional backup files |
| download_url | VARCHAR(500) | | Backup download URL |
| checksum | VARCHAR(64) | | File integrity checksum |
| verification_status | VARCHAR(20) | DEFAULT 'pending' | Backup verification |
| description | TEXT | | Backup description |
| include_uploads | BOOLEAN | DEFAULT TRUE | Include uploaded files |
| include_logs | BOOLEAN | DEFAULT FALSE | Include log files |
| include_analytics | BOOLEAN | DEFAULT FALSE | Include analytics data |
| retention_policy | VARCHAR(50) | NOT NULL | Retention policy |
| retention_days | INTEGER | NOT NULL | Retention period |
| auto_cleanup | BOOLEAN | DEFAULT TRUE | Automatic cleanup |
| backup_schedule | VARCHAR(50) | | Backup schedule |
| started_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Backup start time |
| completed_at | TIMESTAMP | | Backup completion time |
| expires_at | TIMESTAMP | | Backup expiration time |
| restored_at | TIMESTAMP | | Restoration timestamp |
| restored_by | UUID | FK → users(id) | Restoration user |
| error_message | TEXT | | Backup error details |
| performance_metrics | JSONB | | Backup performance data |
| created_by | UUID | FK → users(id) | Backup initiator |

**Indexes:**
- `idx_system_backups_backup_type` ON (backup_type)
- `idx_system_backups_status` ON (status)
- `idx_system_backups_database_name` ON (database_name)
- `idx_system_backups_started_at` ON (started_at)
- `idx_system_backups_expires_at` ON (expires_at)
- `idx_system_backups_created_by` ON (created_by)
- `idx_system_backups_retention` ON (retention_policy, expires_at)

**Business Rules:**
- Automated backup scheduling
- Retention policy enforcement
- Integrity verification required
- Secure storage and encryption

---

## Summary

This comprehensive database specification covers all microservices in the P2P delivery platform with:

### **Total Database Statistics:**
- **9 Microservices** with dedicated databases
- **47 Core Tables** with detailed specifications
- **Estimated Total Size**: ~25GB for 1M users, 2M deliveries
- **500+ Indexes** for optimal performance
- **Enterprise-grade features** throughout

### **Key Features Implemented:**
- **Geographic Search** via PostGIS
- **Full-text Search** with trigram indexes
- **Real-time Tracking** with location services
- **Comprehensive Security** with audit trails
- **Payment Processing** with escrow management
- **Multi-channel Notifications** 
- **QR Code Verification** with security features
- **Advanced Analytics** and reporting

### **Business Rules Coverage:**
- Automatic capacity management
- Dynamic pricing algorithms
- Geographic matching optimization
- Security and fraud prevention
- Compliance and regulatory requirements
- Performance monitoring and optimization

Each table includes detailed column specifications, comprehensive indexing strategies, and business rules that ensure data integrity, performance, and scalability for enterprise deployment.