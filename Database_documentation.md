# Database Documentation
## P2P Delivery Platform - Microservices Database Schema

This document provides a comprehensive overview of all database tables across the 9 microservices in the P2P Delivery Platform.

---

## 1. Admin Service

### admin_users
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| user_id | UUID | NO | - | Reference to user in auth service |
| role | admin_role_enum | NO | 'support' | Admin role (super_admin, admin, moderator, support, finance, analyst) |
| permissions | TEXT[] | YES | [] | Additional permissions beyond role-based |
| is_active | BOOLEAN | NO | true | Whether admin is active |
| last_login_at | TIMESTAMP | YES | - | Last login timestamp |
| created_by | UUID | YES | - | Admin who created this admin user |
| metadata | JSONB | YES | {} | Additional admin-specific metadata |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

### admin_activity_log
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| admin_id | UUID | NO | - | Admin user who performed action |
| action | VARCHAR(100) | NO | - | Action performed |
| resource_type | VARCHAR(100) | NO | - | Type of resource affected |
| resource_id | UUID | YES | - | ID of resource affected |
| description | TEXT | NO | - | Action description |
| details | JSONB | YES | {} | Additional action details |
| severity | VARCHAR(20) | NO | 'info' | Action severity level |
| ip_address | INET | YES | - | IP address of admin |
| user_agent | TEXT | YES | - | User agent string |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |

### disputes
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| case_number | VARCHAR(50) | NO | - | Unique case number |
| delivery_id | UUID | NO | - | Related delivery ID |
| customer_id | UUID | NO | - | Customer who raised dispute |
| traveler_id | UUID | YES | - | Traveler involved in dispute |
| category | dispute_category_enum | NO | - | Dispute category |
| priority | dispute_priority_enum | NO | 'medium' | Dispute priority |
| status | dispute_status_enum | NO | 'open' | Dispute status |
| title | VARCHAR(255) | NO | - | Dispute title |
| description | TEXT | NO | - | Dispute description |
| amount_disputed | DECIMAL(10,2) | YES | - | Amount in dispute |
| assignee_id | UUID | YES | - | Admin assigned to dispute |
| resolution | dispute_resolution_enum | YES | - | Resolution type |
| resolution_notes | TEXT | YES | - | Resolution notes |
| resolved_at | TIMESTAMP | YES | - | Resolution timestamp |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

### dispute_evidence
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| dispute_id | UUID | NO | - | Related dispute ID |
| submitted_by | UUID | NO | - | User who submitted evidence |
| evidence_type | evidence_type_enum | NO | - | Type of evidence |
| file_url | VARCHAR(500) | YES | - | URL to evidence file |
| file_name | VARCHAR(255) | YES | - | Original filename |
| file_size | INTEGER | YES | - | File size in bytes |
| description | TEXT | YES | - | Evidence description |
| metadata | JSONB | YES | {} | Additional metadata |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |

### dispute_messages
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| dispute_id | UUID | NO | - | Related dispute ID |
| sender_id | UUID | NO | - | Message sender ID |
| sender_type | sender_type_enum | NO | - | Sender type (user, admin) |
| message_type | message_type_enum | NO | 'text' | Message type |
| content | TEXT | NO | - | Message content |
| attachments | JSONB | YES | [] | Message attachments |
| is_read | BOOLEAN | NO | false | Whether message is read |
| is_deleted | BOOLEAN | NO | false | Whether message is deleted |
| parent_message_id | UUID | YES | - | Parent message for replies |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

### system_configuration
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| category | VARCHAR(100) | NO | - | Configuration category |
| key | VARCHAR(100) | NO | - | Configuration key |
| value | JSONB | NO | - | Configuration value |
| data_type | config_data_type_enum | NO | 'string' | Data type |
| description | TEXT | YES | - | Configuration description |
| is_active | BOOLEAN | NO | true | Whether config is active |
| is_sensitive | BOOLEAN | NO | false | Whether config contains sensitive data |
| updated_by | UUID | NO | - | Admin who last updated |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

### system_backups
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| backup_type | backup_type_enum | NO | - | Type of backup |
| status | backup_status_enum | NO | 'in_progress' | Backup status |
| file_path | VARCHAR(500) | YES | - | Backup file path |
| file_size | BIGINT | YES | - | Backup file size |
| compression_type | compression_type_enum | NO | 'gzip' | Compression type |
| checksum | VARCHAR(255) | YES | - | File checksum |
| retention_days | INTEGER | NO | 30 | Retention period in days |
| created_by | UUID | NO | - | Admin who created backup |
| started_at | TIMESTAMP | YES | - | Backup start time |
| completed_at | TIMESTAMP | YES | - | Backup completion time |
| error_message | TEXT | YES | - | Error message if failed |
| metadata | JSONB | YES | {} | Additional backup metadata |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |

### data_exports
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| export_type | VARCHAR(100) | NO | - | Type of export |
| format | export_format_enum | NO | 'csv' | Export format |
| status | export_status_enum | NO | 'processing' | Export status |
| filters | JSONB | YES | {} | Export filters |
| file_path | VARCHAR(500) | YES | - | Export file path |
| file_size | BIGINT | YES | - | Export file size |
| row_count | INTEGER | YES | - | Number of rows exported |
| requested_by | UUID | NO | - | Admin who requested export |
| download_url | VARCHAR(500) | YES | - | Download URL |
| expires_at | TIMESTAMP | YES | - | Download expiration |
| completed_at | TIMESTAMP | YES | - | Export completion time |
| error_message | TEXT | YES | - | Error message if failed |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |

### daily_metrics
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| date | DATE | NO | - | Metrics date |
| metric_type | VARCHAR(100) | NO | - | Type of metric |
| value | DECIMAL(15,4) | NO | - | Metric value |
| additional_metrics | JSONB | YES | {} | Additional metric data |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |

---

## 2. Auth Service

### users
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| email | VARCHAR(255) | NO | - | User email address |
| email_verified_at | TIMESTAMP | YES | - | Email verification timestamp |
| phone_number | VARCHAR(20) | YES | - | Phone number (E.164 format) |
| phone_verified_at | TIMESTAMP | YES | - | Phone verification timestamp |
| password_hash | VARCHAR(255) | NO | - | Hashed password |
| first_name | VARCHAR(100) | NO | - | User first name |
| last_name | VARCHAR(100) | NO | - | User last name |
| date_of_birth | DATE | YES | - | User date of birth |
| profile_picture_url | VARCHAR(500) | YES | - | Profile picture URL |
| bio | TEXT | YES | - | User bio |
| user_type | user_type_enum | NO | 'customer' | User type |
| status | user_status_enum | NO | 'pending' | User status |
| verification_level | verification_level_enum | NO | 'unverified' | Verification level |
| preferred_language | VARCHAR(10) | YES | 'en' | Preferred language |
| timezone | VARCHAR(50) | YES | 'UTC' | User timezone |
| preferred_currency | VARCHAR(3) | YES | 'USD' | Preferred currency |
| referral_code | VARCHAR(20) | YES | - | User referral code |
| referred_by_user_id | UUID | YES | - | Referrer user ID |
| terms_accepted_at | TIMESTAMP | YES | - | Terms acceptance timestamp |
| privacy_accepted_at | TIMESTAMP | YES | - | Privacy acceptance timestamp |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |
| deleted_at | TIMESTAMP | YES | - | Soft delete timestamp |

### user_sessions
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| user_id | UUID | NO | - | User ID |
| session_token | VARCHAR(255) | NO | - | Session token |
| refresh_token | VARCHAR(255) | YES | - | Refresh token |
| device_type | device_type_enum | YES | - | Device type |
| platform | platform_enum | YES | - | Platform |
| device_id | VARCHAR(255) | YES | - | Device identifier |
| ip_address | INET | YES | - | IP address |
| user_agent | TEXT | YES | - | User agent string |
| is_active | BOOLEAN | NO | true | Whether session is active |
| last_activity_at | TIMESTAMP | YES | - | Last activity timestamp |
| expires_at | TIMESTAMP | NO | - | Session expiration |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

### email_verification_tokens
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| user_id | UUID | NO | - | User ID |
| token | VARCHAR(255) | NO | - | Verification token |
| email | VARCHAR(255) | NO | - | Email to verify |
| expires_at | TIMESTAMP | NO | - | Token expiration |
| used_at | TIMESTAMP | YES | - | Token usage timestamp |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |

### password_reset_tokens
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| user_id | UUID | NO | - | User ID |
| token | VARCHAR(255) | NO | - | Reset token |
| expires_at | TIMESTAMP | NO | - | Token expiration |
| used_at | TIMESTAMP | YES | - | Token usage timestamp |
| ip_address | INET | YES | - | IP address |
| user_agent | TEXT | YES | - | User agent string |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |

### user_two_factor_auth
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| user_id | UUID | NO | - | User ID |
| secret | VARCHAR(255) | NO | - | 2FA secret |
| is_enabled | BOOLEAN | NO | false | Whether 2FA is enabled |
| backup_codes | TEXT[] | YES | - | Backup codes |
| last_used_at | TIMESTAMP | YES | - | Last usage timestamp |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

---

## 3. Delivery Request Service

### delivery_requests
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| customer_id | UUID | NO | - | Customer ID |
| title | VARCHAR(255) | NO | - | Request title |
| description | TEXT | YES | - | Request description |
| category | item_category_enum | NO | - | Item category |
| status | delivery_request_status_enum | NO | 'pending' | Request status |
| urgency | urgency_level_enum | NO | 'standard' | Urgency level |
| item_name | VARCHAR(255) | NO | - | Item name |
| item_description | TEXT | YES | - | Item description |
| quantity | INTEGER | NO | 1 | Item quantity |
| weight | DECIMAL(8,2) | NO | - | Item weight |
| dimensions | JSONB | YES | - | Item dimensions |
| value | DECIMAL(12,2) | YES | - | Item value |
| is_fragile | BOOLEAN | NO | false | Whether item is fragile |
| is_perishable | BOOLEAN | NO | false | Whether item is perishable |
| is_hazardous | BOOLEAN | NO | false | Whether item is hazardous |
| requires_signature | BOOLEAN | NO | false | Whether signature required |
| item_images | TEXT[] | YES | - | Item images |
| pickup_address | VARCHAR(500) | NO | - | Pickup address |
| pickup_coordinates | GEOGRAPHY(POINT) | YES | - | Pickup coordinates |
| pickup_contact_name | VARCHAR(255) | YES | - | Pickup contact name |
| pickup_contact_phone | VARCHAR(20) | YES | - | Pickup contact phone |
| pickup_instructions | TEXT | YES | - | Pickup instructions |
| pickup_time_start | TIMESTAMP | YES | - | Pickup time window start |
| pickup_time_end | TIMESTAMP | YES | - | Pickup time window end |
| flexible_pickup_timing | BOOLEAN | NO | false | Whether pickup timing is flexible |
| preferred_pickup_days | TEXT[] | YES | - | Preferred pickup days |
| delivery_address | VARCHAR(500) | NO | - | Delivery address |
| delivery_coordinates | GEOGRAPHY(POINT) | YES | - | Delivery coordinates |
| delivery_contact_name | VARCHAR(255) | YES | - | Delivery contact name |
| delivery_contact_phone | VARCHAR(20) | YES | - | Delivery contact phone |
| delivery_instructions | TEXT | YES | - | Delivery instructions |
| delivery_time_start | TIMESTAMP | YES | - | Delivery time window start |
| delivery_time_end | TIMESTAMP | YES | - | Delivery time window end |
| requires_recipient_presence | BOOLEAN | NO | false | Whether recipient must be present |
| max_price | DECIMAL(10,2) | NO | - | Maximum price |
| auto_accept_price | DECIMAL(10,2) | YES | - | Auto-accept price |
| estimated_price | DECIMAL(10,2) | YES | - | Estimated price |
| preferred_travelers | UUID[] | YES | - | Preferred traveler IDs |
| blacklisted_travelers | UUID[] | YES | - | Blacklisted traveler IDs |
| min_traveler_rating | DECIMAL(3,2) | NO | 0.00 | Minimum traveler rating |
| verification_required | BOOLEAN | NO | false | Whether verification required |
| insurance_required | BOOLEAN | NO | false | Whether insurance required |
| background_check_required | BOOLEAN | NO | false | Whether background check required |
| notification_preferences | JSONB | YES | {} | Notification preferences |
| special_instructions | TEXT | YES | - | Special instructions |
| tags | TEXT[] | YES | - | Request tags |
| expires_at | TIMESTAMP | YES | - | Request expiration |
| cancelled_at | TIMESTAMP | YES | - | Cancellation timestamp |
| cancellation_reason | TEXT | YES | - | Cancellation reason |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

### delivery_offers
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| delivery_request_id | UUID | NO | - | Delivery request ID |
| traveler_id | UUID | NO | - | Traveler ID |
| offered_price | DECIMAL(10,2) | NO | - | Offered price |
| message | TEXT | YES | - | Offer message |
| estimated_pickup_time | TIMESTAMP | YES | - | Estimated pickup time |
| estimated_delivery_time | TIMESTAMP | YES | - | Estimated delivery time |
| status | offer_status_enum | NO | 'pending' | Offer status |
| expires_at | TIMESTAMP | YES | - | Offer expiration |
| accepted_at | TIMESTAMP | YES | - | Acceptance timestamp |
| declined_at | TIMESTAMP | YES | - | Decline timestamp |
| decline_reason | TEXT | YES | - | Decline reason |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

### deliveries
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| delivery_request_id | UUID | NO | - | Delivery request ID |
| delivery_offer_id | UUID | NO | - | Accepted delivery offer ID |
| customer_id | UUID | NO | - | Customer ID |
| traveler_id | UUID | NO | - | Traveler ID |
| status | delivery_status_enum | NO | 'accepted' | Delivery status |
| agreed_price | DECIMAL(10,2) | NO | - | Agreed price |
| actual_pickup_time | TIMESTAMP | YES | - | Actual pickup time |
| actual_delivery_time | TIMESTAMP | YES | - | Actual delivery time |
| pickup_confirmation | JSONB | YES | - | Pickup confirmation data |
| delivery_confirmation | JSONB | YES | - | Delivery confirmation data |
| tracking_number | VARCHAR(50) | YES | - | Tracking number |
| notes | TEXT | YES | - | Delivery notes |
| rating_by_customer | INTEGER | YES | - | Customer rating |
| rating_by_traveler | INTEGER | YES | - | Traveler rating |
| customer_feedback | TEXT | YES | - | Customer feedback |
| traveler_feedback | TEXT | YES | - | Traveler feedback |
| cancelled_at | TIMESTAMP | YES | - | Cancellation timestamp |
| cancellation_reason | TEXT | YES | - | Cancellation reason |
| cancelled_by | UUID | YES | - | Who cancelled |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

---

## 4. Location Service

### location_tracking
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| delivery_id | UUID | NO | - | Delivery ID |
| user_id | UUID | NO | - | User ID |
| coordinates | GEOGRAPHY(POINT) | NO | - | GPS coordinates |
| accuracy | DECIMAL(8,2) | YES | - | GPS accuracy in meters |
| altitude | DECIMAL(10,2) | YES | - | Altitude |
| bearing | DECIMAL(6,2) | YES | - | Bearing/direction |
| speed | DECIMAL(8,2) | YES | - | Speed |
| battery_level | INTEGER | YES | - | Device battery level |
| network_type | VARCHAR(20) | YES | - | Network type |
| timestamp | TIMESTAMP | NO | - | Location timestamp |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |

### geofences
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| name | VARCHAR(255) | NO | - | Geofence name |
| type | geofence_type_enum | NO | - | Geofence type |
| delivery_id | UUID | YES | - | Related delivery ID |
| geometry_type | geometry_type_enum | NO | - | Geometry type |
| center_coordinates | GEOGRAPHY(POINT) | YES | - | Center coordinates |
| radius | INTEGER | YES | - | Radius in meters |
| polygon_coordinates | GEOGRAPHY(POLYGON) | YES | - | Polygon coordinates |
| notifications | JSONB | YES | {} | Notification settings |
| active | BOOLEAN | NO | true | Whether geofence is active |
| start_time | TIMESTAMP | YES | - | Start time |
| end_time | TIMESTAMP | YES | - | End time |
| timezone | VARCHAR(50) | NO | 'UTC' | Timezone |
| metadata | JSONB | YES | {} | Additional metadata |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

### geofence_events
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| geofence_id | UUID | NO | - | Geofence ID |
| user_id | UUID | NO | - | User ID |
| delivery_id | UUID | YES | - | Delivery ID |
| event_type | geofence_event_type_enum | NO | - | Event type |
| coordinates | GEOGRAPHY(POINT) | YES | - | Event coordinates |
| dwell_time | INTEGER | YES | - | Dwell time in seconds |
| triggered_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Event trigger time |

### emergency_locations
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| delivery_id | UUID | NO | - | Delivery ID |
| user_id | UUID | NO | - | User ID |
| emergency_type | emergency_type_enum | NO | - | Emergency type |
| coordinates | GEOGRAPHY(POINT) | NO | - | Emergency location |
| accuracy | DECIMAL(8,2) | YES | - | GPS accuracy |
| description | TEXT | NO | - | Emergency description |
| contact_number | VARCHAR(20) | YES | - | Contact number |
| requires_assistance | BOOLEAN | NO | false | Whether assistance required |
| severity | emergency_severity_enum | NO | - | Emergency severity |
| status | emergency_status_enum | NO | 'reported' | Emergency status |
| resolved_at | TIMESTAMP | YES | - | Resolution timestamp |
| resolution_notes | TEXT | YES | - | Resolution notes |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |

### tracking_sessions
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| delivery_id | UUID | NO | - | Delivery ID |
| user_id | UUID | NO | - | User ID |
| status | tracking_status_enum | NO | 'active' | Session status |
| settings | JSONB | YES | {} | Tracking settings |
| privacy_settings | JSONB | YES | {} | Privacy settings |
| started_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Session start time |
| stopped_at | TIMESTAMP | YES | - | Session stop time |
| last_update_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Last update time |
| total_updates | INTEGER | NO | 0 | Total location updates |
| total_distance | DECIMAL(10,2) | NO | 0 | Total distance traveled |
| total_duration | INTEGER | NO | 0 | Total duration in seconds |

### privacy_settings
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| user_id | UUID | NO | - | User ID |
| tracking_level | VARCHAR(20) | NO | 'precise' | Tracking precision level |
| share_with | JSONB | YES | {} | Data sharing preferences |
| data_retention_days | INTEGER | NO | 90 | Data retention period |
| delete_after_delivery | BOOLEAN | NO | false | Auto-delete after delivery |
| anonymization_enabled | BOOLEAN | NO | true | Enable data anonymization |
| anonymization_delay_hours | INTEGER | NO | 24 | Anonymization delay |
| notification_preferences | JSONB | YES | {} | Notification preferences |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

### location_cache
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| delivery_id | UUID | NO | - | Delivery ID |
| user_id | UUID | NO | - | User ID |
| cached_locations | JSONB | NO | - | Cached location data |
| sync_reason | VARCHAR(50) | YES | - | Reason for caching |
| processed | BOOLEAN | NO | false | Whether processed |
| cached_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Cache timestamp |
| processed_at | TIMESTAMP | YES | - | Processing timestamp |

### route_optimizations
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| delivery_id | UUID | YES | - | Delivery ID |
| origin_coordinates | GEOGRAPHY(POINT) | NO | - | Origin coordinates |
| destination_coordinates | GEOGRAPHY(POINT) | NO | - | Destination coordinates |
| waypoints | JSONB | YES | - | Route waypoints |
| optimized_route | JSONB | NO | - | Optimized route data |
| total_distance | DECIMAL(10,2) | NO | - | Total distance |
| total_duration | INTEGER | NO | - | Total duration in seconds |
| total_detour | DECIMAL(10,2) | NO | 0.00 | Total detour distance |
| fuel_cost | DECIMAL(8,2) | YES | - | Estimated fuel cost |
| toll_cost | DECIMAL(8,2) | YES | - | Estimated toll cost |
| traffic_conditions | JSONB | YES | - | Traffic conditions |
| alternatives | JSONB | YES | - | Alternative routes |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| expires_at | TIMESTAMP | YES | - | Route expiration |

---

## 5. Notification Service

### notification_templates
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| name | VARCHAR(255) | NO | - | Template name |
| description | TEXT | YES | - | Template description |
| category | notification_category_enum | NO | - | Notification category |
| push_template | JSONB | YES | - | Push notification template |
| email_template | JSONB | YES | - | Email template |
| sms_template | JSONB | YES | - | SMS template |
| in_app_template | JSONB | YES | - | In-app notification template |
| variables | JSONB | YES | [] | Template variables |
| targeting | JSONB | YES | {} | Targeting conditions |
| status | template_status_enum | NO | 'active' | Template status |
| version | INTEGER | NO | 1 | Template version |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |
| created_by | UUID | YES | - | Creator ID |

### notifications
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| user_id | UUID | NO | - | User ID |
| template_id | UUID | YES | - | Template ID |
| notification_type | notification_type_enum | NO | - | Notification type |
| category | notification_category_enum | NO | - | Notification category |
| title | VARCHAR(255) | NO | - | Notification title |
| message | TEXT | NO | - | Notification message |
| push_data | JSONB | YES | - | Push-specific data |
| email_data | JSONB | YES | - | Email-specific data |
| sms_data | JSONB | YES | - | SMS-specific data |
| in_app_data | JSONB | YES | - | In-app-specific data |
| status | notification_status_enum | NO | 'sent' | Notification status |
| priority | notification_priority_enum | NO | 'normal' | Notification priority |
| sent_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Send timestamp |
| delivered_at | TIMESTAMP | YES | - | Delivery timestamp |
| read_at | TIMESTAMP | YES | - | Read timestamp |
| clicked_at | TIMESTAMP | YES | - | Click timestamp |
| external_id | VARCHAR(255) | YES | - | Provider-specific ID |
| failure_reason | TEXT | YES | - | Failure reason |
| delivery_id | UUID | YES | - | Related delivery ID |
| trip_id | UUID | YES | - | Related trip ID |
| metadata | JSONB | YES | {} | Additional metadata |

### notification_preferences
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| user_id | UUID | NO | - | User ID |
| push_enabled | BOOLEAN | NO | true | Push notifications enabled |
| push_categories | JSONB | YES | {} | Push category preferences |
| push_quiet_hours | JSONB | YES | - | Push quiet hours |
| email_enabled | BOOLEAN | NO | true | Email notifications enabled |
| email_categories | JSONB | YES | {} | Email category preferences |
| email_frequency | VARCHAR(20) | NO | 'immediate' | Email frequency |
| sms_enabled | BOOLEAN | NO | false | SMS notifications enabled |
| sms_categories | JSONB | YES | {} | SMS category preferences |
| in_app_enabled | BOOLEAN | NO | true | In-app notifications enabled |
| in_app_categories | JSONB | YES | {} | In-app category preferences |
| language | VARCHAR(10) | NO | 'en' | Notification language |
| timezone | VARCHAR(50) | NO | 'UTC' | User timezone |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

### device_tokens
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| user_id | UUID | NO | - | User ID |
| token | VARCHAR(500) | NO | - | Device token |
| platform | platform_enum | NO | - | Device platform |
| device_id | VARCHAR(255) | YES | - | Device identifier |
| app_version | VARCHAR(20) | YES | - | App version |
| active | BOOLEAN | NO | true | Whether token is active |
| last_used_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Last usage timestamp |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

### bulk_notifications
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| template_id | UUID | YES | - | Template ID |
| operation | bulk_operation_enum | NO | - | Bulk operation type |
| status | bulk_status_enum | NO | 'processing' | Bulk operation status |
| total_recipients | INTEGER | NO | - | Total recipients |
| processed_count | INTEGER | NO | 0 | Processed count |
| successful_count | INTEGER | NO | 0 | Successful count |
| failed_count | INTEGER | NO | 0 | Failed count |
| batch_size | INTEGER | NO | 100 | Batch size |
| delay_between_batches | INTEGER | NO | 10 | Delay in seconds |
| scheduled_at | TIMESTAMP | YES | - | Scheduled time |
| started_at | TIMESTAMP | YES | - | Start time |
| completed_at | TIMESTAMP | YES | - | Completion time |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| created_by | UUID | YES | - | Creator ID |

### notification_webhooks
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| url | VARCHAR(500) | NO | - | Webhook URL |
| events | TEXT[] | NO | - | Subscribed events |
| secret | VARCHAR(255) | NO | - | Webhook secret |
| active | BOOLEAN | NO | true | Whether webhook is active |
| filters | JSONB | YES | {} | Event filters |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |
| last_triggered_at | TIMESTAMP | YES | - | Last trigger time |
| total_attempts | INTEGER | NO | 0 | Total attempts |
| successful_attempts | INTEGER | NO | 0 | Successful attempts |
| failed_attempts | INTEGER | NO | 0 | Failed attempts |

### notification_analytics
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| notification_id | UUID | YES | - | Notification ID |
| event_type | VARCHAR(50) | NO | - | Event type |
| event_data | JSONB | YES | {} | Event data |
| timestamp | TIMESTAMP | NO | CURRENT_TIMESTAMP | Event timestamp |
| user_agent | TEXT | YES | - | User agent |
| ip_address | INET | YES | - | IP address |
| location | JSONB | YES | - | Location data |

### email_templates
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| template_id | UUID | YES | - | Related template ID |
| name | VARCHAR(255) | NO | - | Template name |
| subject_template | TEXT | NO | - | Email subject template |
| html_template | TEXT | NO | - | HTML email template |
| text_template | TEXT | YES | - | Text email template |
| preview_text | VARCHAR(255) | YES | - | Email preview text |
| from_name | VARCHAR(255) | NO | 'P2P Delivery' | From name |
| from_email | VARCHAR(255) | NO | 'noreply@p2pdelivery.com' | From email |
| reply_to | VARCHAR(255) | YES | - | Reply-to address |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

### notification_queue
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| notification_data | JSONB | NO | - | Notification data |
| scheduled_at | TIMESTAMP | NO | - | Scheduled time |
| status | VARCHAR(20) | NO | 'pending' | Queue status |
| attempts | INTEGER | NO | 0 | Attempt count |
| max_attempts | INTEGER | NO | 3 | Maximum attempts |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| processed_at | TIMESTAMP | YES | - | Processing timestamp |
| error_message | TEXT | YES | - | Error message |
| next_retry_at | TIMESTAMP | YES | - | Next retry time |

### user_notification_settings
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| user_id | UUID | NO | - | User ID |
| setting_key | VARCHAR(100) | NO | - | Setting key |
| setting_value | JSONB | NO | - | Setting value |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

---

## 6. Payment Service

### payment_intents
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| delivery_id | UUID | NO | - | Delivery ID |
| stripe_payment_intent_id | VARCHAR(255) | YES | - | Stripe payment intent ID |
| amount | INTEGER | NO | - | Amount in cents |
| currency | VARCHAR(3) | NO | 'USD' | Currency code |
| status | ENUM | NO | 'requires_payment_method' | Payment status |
| payment_method_id | VARCHAR(255) | YES | - | Payment method ID |
| client_secret | VARCHAR(255) | YES | - | Client secret |
| customer_id | UUID | NO | - | Customer ID |
| customer_email | VARCHAR(255) | YES | - | Customer email |
| traveler_id | UUID | YES | - | Traveler ID |
| platform_fee | INTEGER | NO | 0 | Platform fee in cents |
| processing_fee | INTEGER | NO | 0 | Processing fee in cents |
| insurance_fee | INTEGER | NO | 0 | Insurance fee in cents |
| total_fees | INTEGER | NO | 0 | Total fees in cents |
| billing_details | JSONB | YES | {} | Billing details |
| metadata | JSONB | YES | {} | Additional metadata |
| receipt_email | VARCHAR(255) | YES | - | Receipt email |
| receipt_url | TEXT | YES | - | Receipt URL |
| confirmed_at | TIMESTAMP | YES | - | Confirmation timestamp |
| failed_at | TIMESTAMP | YES | - | Failure timestamp |
| canceled_at | TIMESTAMP | YES | - | Cancellation timestamp |
| refunded_at | TIMESTAMP | YES | - | Refund timestamp |
| failure_reason | TEXT | YES | - | Failure reason |
| failure_code | VARCHAR(50) | YES | - | Failure code |
| risk_score | DECIMAL(3,2) | YES | - | Risk score |
| risk_level | ENUM | YES | - | Risk level |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

### escrow_accounts
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| payment_intent_id | UUID | NO | - | Payment intent ID |
| delivery_id | UUID | NO | - | Delivery ID |
| amount | INTEGER | NO | - | Escrow amount in cents |
| currency | VARCHAR(3) | NO | 'USD' | Currency code |
| status | ENUM | NO | 'pending' | Escrow status |
| held_at | TIMESTAMP | YES | - | Hold timestamp |
| released_at | TIMESTAMP | YES | - | Release timestamp |
| release_reason | TEXT | YES | - | Release reason |
| dispute_id | UUID | YES | - | Related dispute ID |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

### payouts
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| traveler_id | UUID | NO | - | Traveler ID |
| delivery_id | UUID | YES | - | Delivery ID |
| amount | INTEGER | NO | - | Payout amount in cents |
| currency | VARCHAR(3) | NO | 'USD' | Currency code |
| status | ENUM | NO | 'pending' | Payout status |
| stripe_payout_id | VARCHAR(255) | YES | - | Stripe payout ID |
| payout_account_id | UUID | NO | - | Payout account ID |
| fee_amount | INTEGER | NO | 0 | Fee amount in cents |
| net_amount | INTEGER | NO | - | Net payout amount |
| description | TEXT | YES | - | Payout description |
| failure_reason | TEXT | YES | - | Failure reason |
| processed_at | TIMESTAMP | YES | - | Processing timestamp |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

### payout_accounts
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| traveler_id | UUID | NO | - | Traveler ID |
| stripe_account_id | VARCHAR(255) | YES | - | Stripe account ID |
| account_type | ENUM | NO | 'express' | Account type |
| status | ENUM | NO | 'pending' | Account status |
| details_submitted | BOOLEAN | NO | false | Whether details submitted |
| charges_enabled | BOOLEAN | NO | false | Whether charges enabled |
| payouts_enabled | BOOLEAN | NO | false | Whether payouts enabled |
| requirements | JSONB | YES | {} | Account requirements |
| capabilities | JSONB | YES | {} | Account capabilities |
| business_profile | JSONB | YES | {} | Business profile |
| individual_profile | JSONB | YES | {} | Individual profile |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

### refunds
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| payment_intent_id | UUID | NO | - | Payment intent ID |
| stripe_refund_id | VARCHAR(255) | YES | - | Stripe refund ID |
| amount | INTEGER | NO | - | Refund amount in cents |
| currency | VARCHAR(3) | NO | 'USD' | Currency code |
| reason | ENUM | NO | 'requested_by_customer' | Refund reason |
| status | ENUM | NO | 'pending' | Refund status |
| description | TEXT | YES | - | Refund description |
| failure_reason | TEXT | YES | - | Failure reason |
| processed_at | TIMESTAMP | YES | - | Processing timestamp |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

### transaction_logs
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| payment_intent_id | UUID | YES | - | Payment intent ID |
| transaction_type | ENUM | NO | - | Transaction type |
| amount | INTEGER | NO | - | Transaction amount |
| currency | VARCHAR(3) | NO | 'USD' | Currency code |
| status | ENUM | NO | - | Transaction status |
| provider | VARCHAR(50) | NO | 'stripe' | Payment provider |
| provider_transaction_id | VARCHAR(255) | YES | - | Provider transaction ID |
| metadata | JSONB | YES | {} | Transaction metadata |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |

### fraud_analysis
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| payment_intent_id | UUID | NO | - | Payment intent ID |
| risk_score | DECIMAL(3,2) | NO | - | Risk score (0-1) |
| risk_level | ENUM | NO | - | Risk level |
| factors | JSONB | YES | {} | Risk factors |
| ip_address | INET | YES | - | IP address |
| device_fingerprint | VARCHAR(255) | YES | - | Device fingerprint |
| geolocation | JSONB | YES | - | Geolocation data |
| velocity_checks | JSONB | YES | {} | Velocity check results |
| blacklist_checks | JSONB | YES | {} | Blacklist check results |
| machine_learning_score | DECIMAL(3,2) | YES | - | ML model score |
| manual_review_required | BOOLEAN | NO | false | Whether manual review required |
| reviewed_by | UUID | YES | - | Admin who reviewed |
| review_notes | TEXT | YES | - | Review notes |
| reviewed_at | TIMESTAMP | YES | - | Review timestamp |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

### currency_exchanges
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| from_currency | VARCHAR(3) | NO | - | Source currency |
| to_currency | VARCHAR(3) | NO | - | Target currency |
| exchange_rate | DECIMAL(10,6) | NO | - | Exchange rate |
| provider | VARCHAR(50) | NO | - | Rate provider |
| valid_from | TIMESTAMP | NO | - | Rate validity start |
| valid_until | TIMESTAMP | NO | - | Rate validity end |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |

### pricing_factors
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| factor_type | VARCHAR(50) | NO | - | Factor type |
| factor_name | VARCHAR(100) | NO | - | Factor name |
| base_value | DECIMAL(8,4) | NO | - | Base factor value |
| current_value | DECIMAL(8,4) | NO | - | Current factor value |
| min_value | DECIMAL(8,4) | YES | - | Minimum value |
| max_value | DECIMAL(8,4) | YES | - | Maximum value |
| update_frequency | INTEGER | NO | 3600 | Update frequency in seconds |
| is_active | BOOLEAN | NO | true | Whether factor is active |
| metadata | JSONB | YES | {} | Additional metadata |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

### payment_analytics
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| date | DATE | NO | - | Analytics date |
| metric_name | VARCHAR(100) | NO | - | Metric name |
| metric_value | DECIMAL(15,4) | NO | - | Metric value |
| currency | VARCHAR(3) | YES | 'USD' | Currency (for monetary metrics) |
| dimensions | JSONB | YES | {} | Metric dimensions |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |

### subscriptions
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| user_id | UUID | NO | - | User ID |
| stripe_subscription_id | VARCHAR(255) | YES | - | Stripe subscription ID |
| plan_id | VARCHAR(100) | NO | - | Subscription plan ID |
| status | ENUM | NO | 'active' | Subscription status |
| current_period_start | TIMESTAMP | NO | - | Current period start |
| current_period_end | TIMESTAMP | NO | - | Current period end |
| cancel_at_period_end | BOOLEAN | NO | false | Cancel at period end |
| canceled_at | TIMESTAMP | YES | - | Cancellation timestamp |
| trial_start | TIMESTAMP | YES | - | Trial start |
| trial_end | TIMESTAMP | YES | - | Trial end |
| metadata | JSONB | YES | {} | Subscription metadata |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

---

## 7. QR Code Service

### qr_codes
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| delivery_id | UUID | NO | - | Delivery ID |
| qr_type | qr_type_enum | NO | - | QR code type (pickup, delivery) |
| encrypted_data | TEXT | NO | - | Encrypted QR data |
| image_data | TEXT | YES | - | Base64 encoded QR image |
| download_url | VARCHAR(500) | YES | - | QR code download URL |
| backup_code_hash | VARCHAR(255) | NO | - | Hashed backup code |
| security_level | security_level_enum | NO | 'standard' | Security level |
| security_features | JSONB | YES | {} | Security features |
| expires_at | TIMESTAMPTZ | NO | - | QR code expiration |
| used_at | TIMESTAMPTZ | YES | - | Usage timestamp |
| status | qr_status_enum | NO | 'active' | QR code status |
| location_bound | BOOLEAN | NO | false | Whether location-bound |
| bound_coordinates | GEOGRAPHY(POINT) | YES | - | Bound coordinates |
| bound_radius | INTEGER | YES | - | Bound radius in meters |
| created_at | TIMESTAMPTZ | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMPTZ | NO | CURRENT_TIMESTAMP | Record update time |
| created_by | UUID | YES | - | Creator ID |
| revoked_at | TIMESTAMPTZ | YES | - | Revocation timestamp |
| revoked_reason | TEXT | YES | - | Revocation reason |
| revoked_by | UUID | YES | - | Who revoked |
| additional_data | JSONB | YES | {} | Additional data |
| version | INTEGER | NO | 1 | Version for optimistic locking |

### qr_code_scans
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| qr_code_id | UUID | NO | - | QR code ID |
| scanned_by | UUID | NO | - | User who scanned |
| scan_result | scan_result_enum | NO | - | Scan result |
| scan_location | GEOGRAPHY(POINT) | YES | - | Scan location |
| scan_accuracy | FLOAT | YES | - | GPS accuracy in meters |
| device_info | JSONB | YES | {} | Device information |
| additional_verification | JSONB | YES | {} | Additional verification data |
| failure_reason | TEXT | YES | - | Failure reason |
| response_time_ms | INTEGER | YES | - | Response time in milliseconds |
| ip_address | INET | YES | - | IP address |
| user_agent | TEXT | YES | - | User agent |
| scanned_at | TIMESTAMPTZ | NO | CURRENT_TIMESTAMP | Scan timestamp |
| security_flags | JSONB | YES | {} | Security flags |
| risk_score | FLOAT | NO | 0.0 | Risk score (0-1) |

### qr_emergency_overrides
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| delivery_id | UUID | NO | - | Delivery ID |
| qr_code_id | UUID | YES | - | Related QR code ID |
| override_reason | TEXT | NO | - | Override reason |
| description | TEXT | YES | - | Override description |
| alternative_verification | JSONB | YES | {} | Alternative verification |
| requested_by | UUID | NO | - | Who requested |
| approved_by | UUID | YES | - | Who approved |
| alternative_code_hash | VARCHAR(255) | NO | - | Hashed alternative code |
| valid_until | TIMESTAMPTZ | NO | - | Override validity end |
| used_at | TIMESTAMPTZ | YES | - | Usage timestamp |
| used_by | UUID | YES | - | Who used |
| use_location | GEOGRAPHY(POINT) | YES | - | Usage location |
| verification_evidence | JSONB | YES | {} | Verification evidence |
| status | VARCHAR(50) | NO | 'pending' | Override status |
| approval_notes | TEXT | YES | - | Approval notes |
| additional_restrictions | JSONB | YES | {} | Additional restrictions |
| created_at | TIMESTAMPTZ | NO | CURRENT_TIMESTAMP | Record creation time |
| approved_at | TIMESTAMPTZ | YES | - | Approval timestamp |
| rejected_at | TIMESTAMPTZ | YES | - | Rejection timestamp |

### qr_code_analytics
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| date | DATE | NO | - | Analytics date |
| qr_type | qr_type_enum | YES | - | QR code type |
| security_level | security_level_enum | YES | - | Security level |
| total_generated | INTEGER | NO | 0 | Total generated |
| total_scanned | INTEGER | NO | 0 | Total scanned |
| successful_scans | INTEGER | NO | 0 | Successful scans |
| failed_scans | INTEGER | NO | 0 | Failed scans |
| expired_codes | INTEGER | NO | 0 | Expired codes |
| revoked_codes | INTEGER | NO | 0 | Revoked codes |
| avg_scan_time_ms | FLOAT | NO | 0 | Average scan time |
| avg_generation_time_ms | FLOAT | NO | 0 | Average generation time |
| security_incidents | INTEGER | NO | 0 | Security incidents |
| emergency_overrides | INTEGER | NO | 0 | Emergency overrides |
| created_at | TIMESTAMPTZ | NO | CURRENT_TIMESTAMP | Record creation time |

### qr_security_audit
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| event_type | VARCHAR(100) | NO | - | Event type |
| severity | VARCHAR(20) | NO | - | Event severity |
| qr_code_id | UUID | YES | - | QR code ID |
| delivery_id | UUID | YES | - | Delivery ID |
| user_id | UUID | YES | - | User ID |
| ip_address | INET | YES | - | IP address |
| user_agent | TEXT | YES | - | User agent |
| location | GEOGRAPHY(POINT) | YES | - | Event location |
| event_data | JSONB | YES | {} | Event data |
| risk_indicators | JSONB | YES | {} | Risk indicators |
| response_action | VARCHAR(100) | YES | - | Response action |
| resolved_at | TIMESTAMPTZ | YES | - | Resolution timestamp |
| resolved_by | UUID | YES | - | Who resolved |
| resolution_notes | TEXT | YES | - | Resolution notes |
| created_at | TIMESTAMPTZ | NO | CURRENT_TIMESTAMP | Record creation time |

---

## 8. Trip Management Service

### trips
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| traveler_id | UUID | NO | - | Traveler ID |
| template_id | UUID | YES | - | Trip template ID |
| title | VARCHAR(255) | NO | - | Trip title |
| description | TEXT | YES | - | Trip description |
| trip_type | trip_type_enum | NO | 'other' | Trip type |
| status | trip_status_enum | NO | 'upcoming' | Trip status |
| origin_address | VARCHAR(500) | NO | - | Origin address |
| origin_coordinates | GEOGRAPHY(POINT) | YES | - | Origin coordinates |
| origin_airport | VARCHAR(10) | YES | - | Origin airport code |
| origin_terminal | VARCHAR(50) | YES | - | Origin terminal |
| origin_details | TEXT | YES | - | Origin details |
| destination_address | VARCHAR(500) | NO | - | Destination address |
| destination_coordinates | GEOGRAPHY(POINT) | YES | - | Destination coordinates |
| destination_airport | VARCHAR(10) | YES | - | Destination airport code |
| destination_terminal | VARCHAR(50) | YES | - | Destination terminal |
| destination_details | TEXT | YES | - | Destination details |
| departure_time | TIMESTAMP | NO | - | Departure time |
| arrival_time | TIMESTAMP | NO | - | Arrival time |
| estimated_duration | INTEGER | YES | - | Estimated duration in minutes |
| actual_departure_time | TIMESTAMP | YES | - | Actual departure time |
| actual_arrival_time | TIMESTAMP | YES | - | Actual arrival time |
| weight_capacity | DECIMAL(8,2) | NO | 0 | Weight capacity in kg |
| volume_capacity | DECIMAL(8,2) | NO | 0 | Volume capacity in liters |
| item_capacity | INTEGER | NO | 0 | Item capacity count |
| available_weight | DECIMAL(8,2) | NO | 0 | Available weight |
| available_volume | DECIMAL(8,2) | NO | 0 | Available volume |
| available_items | INTEGER | NO | 0 | Available item slots |
| base_price | DECIMAL(10,2) | NO | 0 | Base price |
| price_per_kg | DECIMAL(10,2) | YES | 0.00 | Price per kg |
| price_per_km | DECIMAL(10,2) | YES | 0.00 | Price per km |
| express_multiplier | DECIMAL(3,2) | YES | 1.0 | Express delivery multiplier |
| fragile_multiplier | DECIMAL(3,2) | YES | 1.0 | Fragile item multiplier |
| restrictions | JSONB | YES | {} | Trip restrictions |
| preferences | JSONB | YES | {} | Trip preferences |
| is_recurring | BOOLEAN | NO | false | Whether trip is recurring |
| recurring_pattern | JSONB | YES | - | Recurring pattern |
| parent_trip_id | UUID | YES | - | Parent trip ID |
| visibility | trip_visibility_enum | NO | 'public' | Trip visibility |
| auto_accept | BOOLEAN | NO | false | Auto-accept deliveries |
| auto_accept_price | DECIMAL(10,2) | YES | - | Auto-accept price threshold |
| tags | TEXT[] | YES | - | Trip tags |
| distance | DECIMAL(10,2) | YES | - | Trip distance in km |
| route_data | JSONB | YES | - | Route data |
| cancelled_at | TIMESTAMP | YES | - | Cancellation timestamp |
| cancellation_reason | TEXT | YES | - | Cancellation reason |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |
| deleted_at | TIMESTAMP | YES | - | Soft delete timestamp |

### trip_templates
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| user_id | UUID | NO | - | User ID |
| name | VARCHAR(255) | NO | - | Template name |
| description | TEXT | YES | - | Template description |
| trip_data | JSONB | NO | - | Template trip data |
| usage_count | INTEGER | NO | 0 | Usage count |
| last_used_at | TIMESTAMP | YES | - | Last usage timestamp |
| is_active | BOOLEAN | NO | true | Whether template is active |
| is_public | BOOLEAN | NO | false | Whether template is public |
| category | VARCHAR(100) | YES | - | Template category |
| tags | TEXT[] | YES | - | Template tags |
| metadata | JSONB | YES | {} | Additional metadata |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |
| deleted_at | TIMESTAMP | YES | - | Soft delete timestamp |

### trip_weather
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| trip_id | UUID | NO | - | Trip ID |
| origin_weather | JSONB | YES | - | Origin weather data |
| destination_weather | JSONB | YES | - | Destination weather data |
| route_weather | JSONB | YES | - | Route weather data |
| travel_conditions | VARCHAR(50) | YES | - | Travel conditions |
| alerts | JSONB[] | YES | - | Weather alerts |
| impact_assessment | JSONB | YES | - | Impact assessment |
| data_source | VARCHAR(100) | NO | 'openweathermap' | Data source |
| data_quality | VARCHAR(50) | NO | 'good' | Data quality |
| forecast_for_date | TIMESTAMP | YES | - | Forecast date |
| fetched_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Fetch timestamp |
| expires_at | TIMESTAMP | YES | - | Data expiration |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

---

## 9. User Service

### users
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| email | VARCHAR(255) | NO | - | User email address |
| first_name | VARCHAR(100) | NO | - | User first name |
| last_name | VARCHAR(100) | NO | - | User last name |
| phone_number | VARCHAR(20) | YES | - | Phone number (E.164 format) |
| date_of_birth | DATE | YES | - | User date of birth |
| profile_picture_url | VARCHAR(500) | YES | - | Profile picture URL |
| bio | TEXT | YES | - | User bio |
| user_type | user_type_enum | NO | 'customer' | User type |
| status | user_status_enum | NO | 'pending' | User status |
| verification_level | verification_level_enum | NO | 'unverified' | Verification level |
| preferred_language | VARCHAR(10) | NO | 'en' | Preferred language |
| timezone | VARCHAR(50) | NO | 'UTC' | User timezone |
| preferred_currency | VARCHAR(3) | NO | 'USD' | Preferred currency |
| referral_code | VARCHAR(20) | YES | - | User referral code |
| referred_by_user_id | UUID | YES | - | Referrer user ID |
| terms_accepted_at | TIMESTAMP | YES | - | Terms acceptance timestamp |
| privacy_accepted_at | TIMESTAMP | YES | - | Privacy acceptance timestamp |
| last_active_at | TIMESTAMP | YES | - | Last activity timestamp |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |
| deleted_at | TIMESTAMP | YES | - | Soft delete timestamp |

### user_addresses
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| user_id | UUID | NO | - | User ID |
| type | address_type_enum | NO | - | Address type |
| label | VARCHAR(100) | YES | - | Address label |
| address_line_1 | VARCHAR(255) | NO | - | Address line 1 |
| address_line_2 | VARCHAR(255) | YES | - | Address line 2 |
| city | VARCHAR(100) | NO | - | City |
| state | VARCHAR(100) | YES | - | State/Province |
| postal_code | VARCHAR(20) | YES | - | Postal code |
| country | VARCHAR(100) | NO | - | Country |
| coordinates | GEOGRAPHY(POINT) | YES | - | Address coordinates |
| is_default | BOOLEAN | NO | false | Whether default address |
| is_verified | BOOLEAN | NO | false | Whether address verified |
| instructions | TEXT | YES | - | Delivery instructions |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

### user_verification_documents
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| user_id | UUID | NO | - | User ID |
| document_type | document_type_enum | NO | - | Document type |
| document_number | VARCHAR(100) | YES | - | Document number |
| document_url | VARCHAR(500) | NO | - | Document file URL |
| status | verification_status_enum | NO | 'pending' | Verification status |
| submitted_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Submission timestamp |
| reviewed_at | TIMESTAMP | YES | - | Review timestamp |
| reviewed_by | UUID | YES | - | Reviewer ID |
| expiry_date | DATE | YES | - | Document expiry date |
| rejection_reason | TEXT | YES | - | Rejection reason |
| metadata | JSONB | YES | {} | Additional metadata |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

### user_preferences
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| user_id | UUID | NO | - | User ID |
| notification_preferences | JSONB | YES | {} | Notification preferences |
| privacy_preferences | JSONB | YES | {} | Privacy preferences |
| delivery_preferences | JSONB | YES | {} | Delivery preferences |
| communication_preferences | JSONB | YES | {} | Communication preferences |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

### user_statistics
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| user_id | UUID | NO | - | User ID |
| total_deliveries_as_customer | INTEGER | NO | 0 | Total deliveries as customer |
| total_deliveries_as_traveler | INTEGER | NO | 0 | Total deliveries as traveler |
| successful_deliveries_as_customer | INTEGER | NO | 0 | Successful deliveries as customer |
| successful_deliveries_as_traveler | INTEGER | NO | 0 | Successful deliveries as traveler |
| average_rating_as_customer | DECIMAL(3,2) | YES | - | Average rating as customer |
| average_rating_as_traveler | DECIMAL(3,2) | YES | - | Average rating as traveler |
| total_earnings | DECIMAL(12,2) | NO | 0.00 | Total earnings |
| total_spent | DECIMAL(12,2) | NO | 0.00 | Total spent |
| cancellation_rate_as_customer | DECIMAL(5,4) | NO | 0.0000 | Cancellation rate as customer |
| cancellation_rate_as_traveler | DECIMAL(5,4) | NO | 0.0000 | Cancellation rate as traveler |
| response_time_minutes | INTEGER | YES | - | Average response time |
| reliability_score | DECIMAL(3,2) | YES | - | Reliability score |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

### reviews
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| delivery_id | UUID | NO | - | Delivery ID |
| reviewer_id | UUID | NO | - | Reviewer user ID |
| reviewee_id | UUID | NO | - | Reviewee user ID |
| rating | INTEGER | NO | - | Rating (1-5) |
| title | VARCHAR(255) | YES | - | Review title |
| comment | TEXT | YES | - | Review comment |
| categories | JSONB | YES | {} | Rating categories |
| status | review_status_enum | NO | 'active' | Review status |
| moderation_status | moderation_status_enum | NO | 'approved' | Moderation status |
| moderation_notes | TEXT | YES | - | Moderation notes |
| helpful_votes | INTEGER | NO | 0 | Helpful votes |
| reported_count | INTEGER | NO | 0 | Report count |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

### user_blocks
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| blocker_id | UUID | NO | - | User who blocked |
| blocked_id | UUID | NO | - | User who was blocked |
| reason | block_reason_enum | NO | - | Block reason |
| description | TEXT | YES | - | Block description |
| is_active | BOOLEAN | NO | true | Whether block is active |
| expires_at | TIMESTAMP | YES | - | Block expiration |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

### user_favorites
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| customer_id | UUID | NO | - | Customer user ID |
| traveler_id | UUID | NO | - | Traveler user ID |
| notes | TEXT | YES | - | Notes about favorite |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record update time |

---

## Database Schema Summary

### Total Tables by Service:
- **Admin Service**: 9 tables
- **Auth Service**: 5 tables  
- **Delivery Request Service**: 3 tables
- **Location Service**: 8 tables
- **Notification Service**: 10 tables
- **Payment Service**: 11 tables
- **QR Code Service**: 5 tables
- **Trip Management Service**: 3 tables
- **User Service**: 8 tables

### Grand Total: 62 tables

### Common Patterns:
- Most tables use UUID primary keys
- Timestamps (created_at, updated_at) are standard
- JSONB columns for flexible metadata storage
- Geography/PostGIS support for location data
- Enum types for controlled vocabularies
- Soft deletes (deleted_at) where appropriate
- Audit trails and activity logging
- Foreign key relationships between services via UUID references

### Key Technologies:
- **Database**: PostgreSQL
- **Extensions**: PostGIS, UUID-OSSP, pg_trgm, btree_gin
- **ORM**: Sequelize (Node.js)
- **Geographic Data**: PostGIS GEOGRAPHY types
- **JSON Storage**: JSONB columns
- **Full-text Search**: GIN indexes with trigrams