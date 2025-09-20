# P2P DELIVERY PLATFORM - DETAILED DATABASE SPECIFICATIONS

This document provides comprehensive database specifications for all microservices in the P2P delivery platform, following enterprise-grade design patterns with complete table structures, indexes, business rules, and estimated sizes.

## Table of Contents

1. [User Management Service Tables](#user-management-service-tables)
2. [Authentication Service Tables](#authentication-service-tables)
3. [Trip Management Service Tables](#trip-management-service-tables)
4. [Delivery Request Service Tables](#delivery-request-service-tables)
5. [Payment Service Tables](#payment-service-tables)
6. [Location Service Tables](#location-service-tables)
7. [Notification Service Tables](#notification-service-tables)
8. [QR Code Service Tables](#qr-code-service-tables)
9. [Admin Service Tables](#admin-service-tables)

---

## User Management Service Tables

### 1. Users Table
**Purpose**: Core user information and account management  
**Database**: user_db  
**Estimated Size**: ~2GB (1M users)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique user identifier |
| email | VARCHAR(255) | UNIQUE NOT NULL | User email address |
| email_verified_at | TIMESTAMP | | Email verification timestamp |
| phone_number | VARCHAR(20) | | User phone number |
| phone_verified_at | TIMESTAMP | | Phone verification timestamp |
| password_hash | VARCHAR(255) | NOT NULL | Hashed password |
| first_name | VARCHAR(100) | NOT NULL | User first name |
| last_name | VARCHAR(100) | NOT NULL | User last name |
| date_of_birth | DATE | | User date of birth |
| profile_picture_url | VARCHAR(500) | | Profile picture URL |
| bio | TEXT | | User biography |
| user_type | user_type_enum | NOT NULL, DEFAULT 'customer' | User role type |
| status | user_status_enum | NOT NULL, DEFAULT 'pending' | Account status |
| verification_level | verification_level_enum | NOT NULL, DEFAULT 'unverified' | Verification status |
| preferred_language | VARCHAR(10) | DEFAULT 'en' | Preferred language |
| timezone | VARCHAR(50) | DEFAULT 'UTC' | User timezone |
| preferred_currency | VARCHAR(3) | DEFAULT 'USD' | Preferred currency |
| referral_code | VARCHAR(20) | UNIQUE | User referral code |
| referred_by_user_id | UUID | FK → users(id) | Referrer user ID |
| terms_accepted_at | TIMESTAMP | | Terms acceptance timestamp |
| privacy_accepted_at | TIMESTAMP | | Privacy policy acceptance |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Account creation time |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |
| deleted_at | TIMESTAMP | | Soft deletion timestamp |

**Indexes:**
- `idx_users_email` ON (email)
- `idx_users_phone_number` ON (phone_number)
- `idx_users_status` ON (status)
- `idx_users_user_type` ON (user_type)
- `idx_users_verification_level` ON (verification_level)
- `idx_users_referral_code` ON (referral_code)
- `idx_users_search` ON gin((first_name || ' ' || last_name || ' ' || email) gin_trgm_ops)

**Business Rules:**
- Email must be unique and validated
- Phone verification required for certain operations
- Referral system tracks user acquisition
- Soft deletion preserves data integrity

### 2. User Addresses Table
**Purpose**: User address management for pickup and delivery locations  
**Database**: user_db  
**Estimated Size**: ~500MB (2M addresses)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique address identifier |
| user_id | UUID | NOT NULL, FK → users(id) ON DELETE CASCADE | Address owner |
| type | address_type_enum | NOT NULL, DEFAULT 'other' | Address type |
| label | VARCHAR(100) | | User-defined label |
| street | VARCHAR(255) | NOT NULL | Street address |
| city | VARCHAR(100) | NOT NULL | City name |
| state | VARCHAR(100) | | State/province |
| postal_code | VARCHAR(20) | | Postal/ZIP code |
| country | VARCHAR(2) | NOT NULL | Country code (ISO 3166-1) |
| coordinates | GEOGRAPHY(POINT, 4326) | | GPS coordinates |
| is_default | BOOLEAN | DEFAULT FALSE | Default address flag |
| instructions | TEXT | | Delivery instructions |
| access_code | VARCHAR(50) | | Building access code |
| contact_name | VARCHAR(255) | | Alternative contact name |
| contact_phone | VARCHAR(20) | | Alternative contact phone |
| verified_at | TIMESTAMP | | Address verification timestamp |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Address creation time |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |

**Indexes:**
- `idx_user_addresses_user_id` ON (user_id)
- `idx_user_addresses_coordinates` ON GIST(coordinates)
- `idx_user_addresses_is_default` ON (user_id, is_default) WHERE is_default = true
- `idx_user_addresses_type` ON (type)
- `idx_user_addresses_country` ON (country)

**Business Rules:**
- Only one default address per user
- Coordinates automatically geocoded from address
- Address verification improves delivery success rates
- Access codes encrypted for security

### 3. User Preferences Table
**Purpose**: User settings and preferences configuration  
**Database**: user_db  
**Estimated Size**: ~200MB (1M preference sets)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique preferences identifier |
| user_id | UUID | NOT NULL UNIQUE, FK → users(id) ON DELETE CASCADE | Preferences owner |
| notification_settings | JSONB | DEFAULT '{}' | Notification preferences |
| privacy_settings | JSONB | DEFAULT '{}' | Privacy configuration |
| location_settings | JSONB | DEFAULT '{}' | Location sharing settings |
| payment_settings | JSONB | DEFAULT '{}' | Payment preferences |
| delivery_preferences | JSONB | DEFAULT '{}' | Delivery preferences |
| communication_preferences | JSONB | DEFAULT '{}' | Communication settings |
| security_settings | JSONB | DEFAULT '{}' | Security preferences |
| accessibility_settings | JSONB | DEFAULT '{}' | Accessibility options |
| marketing_preferences | JSONB | DEFAULT '{}' | Marketing opt-in settings |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Preferences creation time |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |

**Indexes:**
- `idx_user_preferences_user_id` ON (user_id)
- `idx_user_preferences_notification_gin` ON gin(notification_settings)
- `idx_user_preferences_privacy_gin` ON gin(privacy_settings)

**Business Rules:**
- One preference set per user
- JSONB structure allows flexible configuration
- Default values ensure system functionality
- Privacy settings control data sharing

### 4. User Statistics Table
**Purpose**: Denormalized user performance and activity metrics  
**Database**: user_db  
**Estimated Size**: ~300MB (1M user stats)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique statistics identifier |
| user_id | UUID | NOT NULL UNIQUE, FK → users(id) ON DELETE CASCADE | Statistics owner |
| total_trips | INTEGER | DEFAULT 0 | Total trips created |
| total_deliveries | INTEGER | DEFAULT 0 | Total deliveries participated |
| successful_deliveries | INTEGER | DEFAULT 0 | Successfully completed deliveries |
| cancelled_deliveries | INTEGER | DEFAULT 0 | Cancelled deliveries |
| total_earnings | DECIMAL(12,2) | DEFAULT 0.00 | Total earnings as traveler |
| total_spent | DECIMAL(12,2) | DEFAULT 0.00 | Total spent as customer |
| average_rating | DECIMAL(3,2) | DEFAULT 0.00 | Average user rating |
| total_ratings | INTEGER | DEFAULT 0 | Total ratings received |
| response_time_minutes | INTEGER | DEFAULT 0 | Average response time |
| completion_rate | DECIMAL(5,2) | DEFAULT 0.00 | Delivery completion rate |
| reliability_score | DECIMAL(5,2) | DEFAULT 0.00 | Reliability metric |
| punctuality_score | DECIMAL(5,2) | DEFAULT 0.00 | Punctuality metric |
| communication_score | DECIMAL(5,2) | DEFAULT 0.00 | Communication rating |
| last_active_at | TIMESTAMP | | Last activity timestamp |
| streak_days | INTEGER | DEFAULT 0 | Current activity streak |
| badges_earned | TEXT[] | DEFAULT '{}' | Achievement badges |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Statistics creation time |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |

**Indexes:**
- `idx_user_statistics_user_id` ON (user_id)
- `idx_user_statistics_average_rating` ON (average_rating DESC)
- `idx_user_statistics_completion_rate` ON (completion_rate DESC)
- `idx_user_statistics_total_deliveries` ON (total_deliveries DESC)
- `idx_user_statistics_last_active` ON (last_active_at DESC)

**Business Rules:**
- Statistics updated via triggers and background jobs
- Ratings calculated from review system
- Performance metrics influence matching algorithms
- Badges gamify user engagement

---

## Authentication Service Tables

### 1. User Sessions Table
**Purpose**: Device session management and security tracking  
**Database**: auth_db  
**Estimated Size**: ~800MB (5M sessions)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique session identifier |
| user_id | UUID | NOT NULL, FK → users(id) ON DELETE CASCADE | Session owner |
| device_id | VARCHAR(255) | | Unique device identifier |
| device_type | device_type_enum | | Device type category |
| platform | platform_enum | | Operating system platform |
| app_version | VARCHAR(20) | | Application version |
| device_name | VARCHAR(255) | | User-defined device name |
| browser_info | JSONB | | Browser information |
| push_token | VARCHAR(500) | | Push notification token |
| ip_address | INET | | Session IP address |
| location | VARCHAR(255) | | Approximate location |
| refresh_token_hash | VARCHAR(255) | | Hashed refresh token |
| access_token_hash | VARCHAR(255) | | Hashed access token |
| expires_at | TIMESTAMP | NOT NULL | Session expiration time |
| last_active_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last activity timestamp |
| is_trusted_device | BOOLEAN | DEFAULT FALSE | Trusted device flag |
| security_flags | JSONB | DEFAULT '{}' | Security indicators |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Session creation time |
| revoked_at | TIMESTAMP | | Session revocation time |
| revocation_reason | VARCHAR(100) | | Revocation reason |

**Indexes:**
- `idx_user_sessions_user_id` ON (user_id)
- `idx_user_sessions_device_id` ON (device_id)
- `idx_user_sessions_expires_at` ON (expires_at)
- `idx_user_sessions_active` ON (user_id) WHERE revoked_at IS NULL
- `idx_user_sessions_ip_address` ON (ip_address)
- `idx_user_sessions_push_token` ON (push_token)

**Business Rules:**
- Sessions automatically expire for security
- Device tracking prevents unauthorized access
- Trusted devices reduce authentication friction
- IP monitoring detects suspicious activity

### 2. Two Factor Authentication Table
**Purpose**: 2FA configuration and backup codes management  
**Database**: auth_db  
**Estimated Size**: ~100MB (500K 2FA configs)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique 2FA identifier |
| user_id | UUID | NOT NULL UNIQUE, FK → users(id) ON DELETE CASCADE | 2FA owner |
| method | two_factor_method_enum | NOT NULL, DEFAULT 'totp' | 2FA method type |
| secret_key | VARCHAR(255) | NOT NULL | Encrypted secret key |
| backup_codes | TEXT[] | | Encrypted backup codes |
| recovery_codes | TEXT[] | | Encrypted recovery codes |
| enabled | BOOLEAN | DEFAULT FALSE | 2FA enabled status |
| enabled_at | TIMESTAMP | | 2FA activation timestamp |
| verified_at | TIMESTAMP | | Initial verification timestamp |
| last_used_at | TIMESTAMP | | Last successful use |
| failed_attempts | INTEGER | DEFAULT 0 | Failed attempt counter |
| locked_until | TIMESTAMP | | Lockout expiration |
| phone_number | VARCHAR(20) | | SMS 2FA phone number |
| email_address | VARCHAR(255) | | Email 2FA address |
| device_tokens | JSONB | DEFAULT '[]' | Push notification tokens |
| settings | JSONB | DEFAULT '{}' | Method-specific settings |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 2FA creation time |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |

**Indexes:**
- `idx_user_two_factor_user_id` ON (user_id)
- `idx_user_two_factor_enabled` ON (enabled)
- `idx_user_two_factor_method` ON (method)
- `idx_user_two_factor_phone` ON (phone_number)

**Business Rules:**
- Multiple 2FA methods supported
- Backup codes for account recovery
- Rate limiting prevents brute force attacks
- Phone/email verification required

### 3. Password Reset Tokens Table
**Purpose**: Secure password reset token management  
**Database**: auth_db  
**Estimated Size**: ~50MB (temporary data)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique token identifier |
| user_id | UUID | NOT NULL, FK → users(id) ON DELETE CASCADE | Token owner |
| token_hash | VARCHAR(255) | NOT NULL | Hashed reset token |
| token_type | reset_token_type_enum | NOT NULL, DEFAULT 'email' | Token delivery method |
| email_address | VARCHAR(255) | | Target email address |
| phone_number | VARCHAR(20) | | Target phone number |
| ip_address | INET | | Request origin IP |
| user_agent | TEXT | | Request user agent |
| expires_at | TIMESTAMP | NOT NULL | Token expiration time |
| used_at | TIMESTAMP | | Token usage timestamp |
| attempts | INTEGER | DEFAULT 0 | Usage attempt counter |
| max_attempts | INTEGER | DEFAULT 3 | Maximum allowed attempts |
| metadata | JSONB | DEFAULT '{}' | Additional token data |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Token creation time |

**Indexes:**
- `idx_password_reset_tokens_user_id` ON (user_id)
- `idx_password_reset_tokens_hash` ON (token_hash)
- `idx_password_reset_tokens_expires` ON (expires_at)
- `idx_password_reset_tokens_email` ON (email_address)

**Business Rules:**
- Tokens expire within 1 hour
- Limited attempts prevent abuse
- IP tracking for security monitoring
- Multiple delivery methods supported

### 4. Login Attempts Table
**Purpose**: Security monitoring and brute force protection  
**Database**: auth_db  
**Estimated Size**: ~200MB (security logs)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique attempt identifier |
| user_id | UUID | FK → users(id) | Target user (if exists) |
| email_attempted | VARCHAR(255) | NOT NULL | Email used in attempt |
| ip_address | INET | NOT NULL | Source IP address |
| user_agent | TEXT | | Request user agent |
| attempt_result | login_result_enum | NOT NULL | Attempt outcome |
| failure_reason | VARCHAR(100) | | Specific failure reason |
| device_fingerprint | VARCHAR(255) | | Device fingerprint hash |
| location_data | JSONB | | Approximate location |
| security_flags | JSONB | DEFAULT '{}' | Security indicators |
| two_factor_used | BOOLEAN | DEFAULT FALSE | 2FA verification used |
| session_created | BOOLEAN | DEFAULT FALSE | Session successfully created |
| risk_score | INTEGER | DEFAULT 0 | Calculated risk score |
| blocked_by_rate_limit | BOOLEAN | DEFAULT FALSE | Rate limit triggered |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Attempt timestamp |

**Indexes:**
- `idx_login_attempts_user_id` ON (user_id)
- `idx_login_attempts_email` ON (email_attempted)
- `idx_login_attempts_ip_address` ON (ip_address)
- `idx_login_attempts_created_at` ON (created_at)
- `idx_login_attempts_result` ON (attempt_result)
- `idx_login_attempts_risk_score` ON (risk_score DESC)

**Business Rules:**
- All login attempts logged for security
- Rate limiting based on IP and email
- Risk scoring influences authentication flow
- Automated blocking of suspicious activity

---

## Trip Management Service Tables

### 1. Trips Table

**Purpose**: Stores traveler trip information with capacity and pricing details  
**Database**: trip_db  
**Estimated Size**: ~1.5GB (500K trips)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique trip identifier |
| traveler_id | UUID | NOT NULL, FK → users(id) | Reference to traveler |
| template_id | UUID | FK → trip_templates(id) | Template used for trip |
| title | VARCHAR(255) | NOT NULL | Trip title/name |
| description | TEXT | | Trip description |
| trip_type | trip_type_enum | NOT NULL, DEFAULT 'other' | Type of transportation |
| status | trip_status_enum | NOT NULL, DEFAULT 'upcoming' | Current trip status |
| origin_address | VARCHAR(500) | NOT NULL | Origin address |
| origin_coordinates | GEOGRAPHY(POINT, 4326) | | Origin GPS coordinates |
| origin_airport | VARCHAR(10) | | Origin airport code |
| origin_terminal | VARCHAR(50) | | Origin terminal |
| origin_details | TEXT | | Additional origin details |
| destination_address | VARCHAR(500) | NOT NULL | Destination address |
| destination_coordinates | GEOGRAPHY(POINT, 4326) | | Destination GPS coordinates |
| destination_airport | VARCHAR(10) | | Destination airport code |
| destination_terminal | VARCHAR(50) | | Destination terminal |
| destination_details | TEXT | | Additional destination details |
| departure_time | TIMESTAMP | NOT NULL | Scheduled departure time |
| arrival_time | TIMESTAMP | NOT NULL | Scheduled arrival time |
| estimated_duration | INTEGER | | Estimated duration in minutes |
| actual_departure_time | TIMESTAMP | | Actual departure time |
| actual_arrival_time | TIMESTAMP | | Actual arrival time |
| weight_capacity | DECIMAL(8,2) | NOT NULL, DEFAULT 0 | Weight capacity in kg |
| volume_capacity | DECIMAL(8,2) | NOT NULL, DEFAULT 0 | Volume capacity in liters |
| item_capacity | INTEGER | NOT NULL, DEFAULT 0 | Maximum number of items |
| available_weight | DECIMAL(8,2) | NOT NULL, DEFAULT 0 | Available weight capacity |
| available_volume | DECIMAL(8,2) | NOT NULL, DEFAULT 0 | Available volume capacity |
| available_items | INTEGER | NOT NULL, DEFAULT 0 | Available item slots |
| base_price | DECIMAL(10,2) | NOT NULL, DEFAULT 0 | Base delivery price |
| price_per_kg | DECIMAL(10,2) | DEFAULT 0.00 | Price per kilogram |
| price_per_km | DECIMAL(10,2) | DEFAULT 0.00 | Price per kilometer |
| express_multiplier | DECIMAL(3,2) | DEFAULT 1.0 | Express delivery multiplier |
| fragile_multiplier | DECIMAL(3,2) | DEFAULT 1.0 | Fragile item multiplier |
| restrictions | JSONB | DEFAULT '{}' | Item restrictions |
| preferences | JSONB | DEFAULT '{}' | Traveler preferences |
| is_recurring | BOOLEAN | DEFAULT FALSE | Recurring trip flag |
| recurring_pattern | JSONB | | Recurring pattern configuration |
| parent_trip_id | UUID | FK → trips(id) | Parent trip for recurring |
| visibility | trip_visibility_enum | DEFAULT 'public' | Trip visibility setting |
| auto_accept | BOOLEAN | DEFAULT FALSE | Auto-accept offers flag |
| auto_accept_price | DECIMAL(10,2) | | Auto-accept price threshold |
| tags | TEXT[] | | Search tags |
| distance | DECIMAL(10,2) | | Trip distance in km |
| route_data | JSONB | | Route information |
| cancelled_at | TIMESTAMP | | Cancellation timestamp |
| cancellation_reason | TEXT | | Cancellation reason |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Trip creation time |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |
| deleted_at | TIMESTAMP | | Soft deletion timestamp |

**Indexes:**
- `idx_trips_traveler_id` ON (traveler_id)
- `idx_trips_status` ON (status)
- `idx_trips_departure_time` ON (departure_time)
- `idx_trips_origin_coordinates` ON GIST(origin_coordinates)
- `idx_trips_destination_coordinates` ON GIST(destination_coordinates)
- `idx_trips_search` ON gin((title || ' ' || COALESCE(description, '')) gin_trgm_ops)
- `idx_trips_capacity` ON (available_weight, available_volume, available_items)
- `idx_trips_status_departure` ON (status, departure_time)

**Business Rules:**
- Available capacity automatically updated when deliveries are accepted
- Recurring trips create child instances based on pattern
- Pricing can be dynamic based on multiple factors
- Geographic search enabled via PostGIS

### 2. Trip Templates Table

**Purpose**: Reusable trip configurations for frequent routes  
**Database**: trip_db  
**Estimated Size**: ~100MB (50K templates)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique template identifier |
| user_id | UUID | NOT NULL, FK → users(id) | Template owner |
| name | VARCHAR(255) | NOT NULL | Template name |
| description | TEXT | | Template description |
| trip_data | JSONB | NOT NULL | Trip configuration data |
| usage_count | INTEGER | DEFAULT 0 | Times template was used |
| last_used_at | TIMESTAMP | | Last usage timestamp |
| is_active | BOOLEAN | DEFAULT TRUE | Template active status |
| is_public | BOOLEAN | DEFAULT FALSE | Public template flag |
| category | VARCHAR(100) | | Template category |
| tags | TEXT[] | | Search tags |
| metadata | JSONB | DEFAULT '{}' | Additional metadata |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Template creation time |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |
| deleted_at | TIMESTAMP | | Soft deletion timestamp |

**Indexes:**
- `idx_trip_templates_user_id` ON (user_id)
- `idx_trip_templates_is_active` ON (is_active)
- `idx_trip_templates_is_public` ON (is_public)
- `idx_trip_templates_category` ON (category)
- `idx_trip_templates_usage_count` ON (usage_count DESC)
- `idx_trip_templates_search` ON gin((name || ' ' || COALESCE(description, '')) gin_trgm_ops)

**Business Rules:**
- Templates can be private or shared publicly
- Usage statistics track template popularity
- JSONB structure allows flexible trip configuration
- Templates speed up trip creation for frequent routes

### 3. Trip Weather Table

**Purpose**: Cached weather data for trip planning and safety  
**Database**: trip_db  
**Estimated Size**: ~200MB (weather data cache)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique weather record identifier |
| trip_id | UUID | NOT NULL, FK → trips(id) ON DELETE CASCADE | Reference to trip |
| origin_weather | JSONB | | Origin weather data |
| destination_weather | JSONB | | Destination weather data |
| route_weather | JSONB | | Route weather conditions |
| travel_conditions | VARCHAR(50) | | Overall travel conditions |
| alerts | JSONB[] | | Weather alerts array |
| impact_assessment | JSONB | | Impact on delivery |
| data_source | VARCHAR(100) | DEFAULT 'openweathermap' | Weather data provider |
| data_quality | VARCHAR(50) | DEFAULT 'good' | Data quality indicator |
| forecast_for_date | TIMESTAMP | | Forecast target date |
| fetched_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Data fetch timestamp |
| expires_at | TIMESTAMP | | Data expiration time |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |

**Indexes:**
- `idx_trip_weather_trip_id` ON (trip_id)
- `idx_trip_weather_fetched_at` ON (fetched_at)
- `idx_trip_weather_expires_at` ON (expires_at)
- `idx_trip_weather_conditions` ON (travel_conditions)

**Business Rules:**
- Weather data expires and requires refresh
- Alerts can affect trip safety and scheduling
- Automated cleanup of expired weather data
- Integration with external weather APIs

---

*[Document continues with remaining services...]*