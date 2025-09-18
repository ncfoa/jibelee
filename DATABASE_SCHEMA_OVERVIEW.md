# P2P Delivery Platform - Database Schema Overview

## Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    %% ============================
    %% AUTHENTICATION SERVICE TABLES (auth_db)
    %% ============================
    USERS {
        uuid id PK
        varchar email UK
        varchar password_hash
        varchar first_name
        varchar last_name
        varchar phone_number
        date date_of_birth
        user_type_enum user_type
        user_status_enum status
        verification_level_enum verification_level
        varchar preferred_language
        varchar timezone
        varchar preferred_currency
        varchar referral_code UK
        uuid referred_by_user_id FK
        timestamp terms_accepted_at
        timestamp privacy_accepted_at
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    USER_SESSIONS {
        uuid id PK
        uuid user_id FK
        varchar device_id
        device_type_enum device_type
        platform_enum platform
        varchar app_version
        varchar push_token
        inet ip_address
        varchar location
        varchar refresh_token_hash
        timestamp expires_at
        timestamp last_active_at
        timestamp created_at
        timestamp revoked_at
    }

    USER_TWO_FACTOR_AUTH {
        uuid id PK
        uuid user_id FK
        varchar secret_key
        text[] backup_codes
        boolean enabled
        timestamp enabled_at
        timestamp created_at
        timestamp updated_at
    }

    PASSWORD_RESET_TOKENS {
        uuid id PK
        uuid user_id FK
        varchar token_hash
        timestamp expires_at
        timestamp used_at
        timestamp created_at
    }

    EMAIL_VERIFICATION_TOKENS {
        uuid id PK
        uuid user_id FK
        varchar email
        varchar token_hash
        timestamp expires_at
        timestamp verified_at
        timestamp created_at
    }

    %% ============================
    %% USER MANAGEMENT SERVICE TABLES (user_db)
    %% ============================
    USER_ADDRESSES {
        uuid id PK
        uuid user_id FK
        address_type_enum type
        varchar label
        varchar street
        varchar city
        varchar state
        varchar postal_code
        varchar country
        geography coordinates
        boolean is_default
        timestamp created_at
        timestamp updated_at
    }

    USER_PREFERENCES {
        uuid id PK
        uuid user_id FK
        jsonb notification_settings
        jsonb privacy_settings
        jsonb location_settings
        jsonb payment_settings
        timestamp created_at
        timestamp updated_at
    }

    USER_STATISTICS {
        uuid id PK
        uuid user_id FK
        integer total_trips
        integer total_deliveries
        integer successful_deliveries
        integer cancelled_deliveries
        decimal total_earnings
        decimal total_spent
        decimal average_rating
        integer total_ratings
        integer response_time_minutes
        decimal completion_rate
        timestamp last_active_at
        timestamp created_at
        timestamp updated_at
    }

    USER_VERIFICATION_DOCUMENTS {
        uuid id PK
        uuid user_id FK
        document_type_enum document_type
        varchar front_image_url
        varchar back_image_url
        varchar selfie_image_url
        verification_status_enum status
        uuid verified_by FK
        timestamp verified_at
        text rejection_reason
        jsonb metadata
        timestamp created_at
        timestamp updated_at
    }

    REVIEWS {
        uuid id PK
        uuid delivery_id FK
        uuid reviewer_id FK
        uuid reviewee_id FK
        integer overall_rating
        text comment
        integer communication_rating
        integer punctuality_rating
        integer carefulness_rating
        integer friendliness_rating
        boolean is_anonymous
        review_status_enum status
        moderation_status_enum moderation_status
        uuid moderated_by FK
        timestamp moderated_at
        text moderation_notes
        timestamp created_at
        timestamp updated_at
    }

    USER_BLOCKS {
        uuid id PK
        uuid blocker_id FK
        uuid blocked_id FK
        block_reason_enum reason
        text comment
        timestamp created_at
    }

    USER_FAVORITES {
        uuid id PK
        uuid customer_id FK
        uuid traveler_id FK
        timestamp added_at
    }

    USER_REPORTS {
        uuid id PK
        uuid reporter_id FK
        uuid reported_id FK
        report_category_enum category
        text description
        report_status_enum status
        uuid reviewed_by FK
        timestamp reviewed_at
        text resolution
        timestamp created_at
    }

    REVIEW_REPORTS {
        uuid id PK
        uuid review_id FK
        uuid reporter_id FK
        report_reason_enum reason
        text description
        report_status_enum status
        uuid reviewed_by FK
        timestamp reviewed_at
        text resolution
        text moderation_action
        timestamp created_at
    }

    %% ============================
    %% TRIP MANAGEMENT SERVICE TABLES (trip_db)
    %% ============================
    TRIPS {
        uuid id PK
        uuid traveler_id FK
        varchar title
        text description
        trip_type_enum trip_type
        trip_status_enum status
        varchar origin_address
        geography origin_coordinates
        varchar origin_airport
        varchar origin_terminal
        text origin_details
        varchar destination_address
        geography destination_coordinates
        varchar destination_airport
        varchar destination_terminal
        text destination_details
        timestamp departure_time
        timestamp arrival_time
        integer estimated_duration
        timestamp actual_departure_time
        timestamp actual_arrival_time
        decimal weight_capacity
        decimal volume_capacity
        integer item_capacity
        decimal available_weight
        decimal available_volume
        integer available_items
        decimal base_price
        decimal price_per_kg
        decimal price_per_km
        decimal express_multiplier
        decimal fragile_multiplier
        jsonb restrictions
        jsonb preferences
        boolean is_recurring
        jsonb recurring_pattern
        uuid parent_trip_id FK
        trip_visibility_enum visibility
        boolean auto_accept
        decimal auto_accept_price
        text[] tags
        timestamp created_at
        timestamp updated_at
        timestamp cancelled_at
        text cancellation_reason
    }

    TRIP_TEMPLATES {
        uuid id PK
        uuid user_id FK
        varchar name
        jsonb trip_data
        integer usage_count
        timestamp last_used_at
        timestamp created_at
        timestamp updated_at
    }

    TRIP_WEATHER {
        uuid id PK
        uuid trip_id FK
        jsonb origin_weather
        jsonb destination_weather
        varchar travel_conditions
        text[] alerts
        timestamp fetched_at
    }

    %% ============================
    %% DELIVERY REQUEST SERVICE TABLES (delivery_db)
    %% ============================
    DELIVERY_REQUESTS {
        uuid id PK
        uuid customer_id FK
        varchar title
        text description
        item_category_enum category
        delivery_request_status_enum status
        urgency_level_enum urgency
        varchar item_name
        text item_description
        integer quantity
        decimal weight
        jsonb dimensions
        decimal value
        boolean is_fragile
        boolean is_perishable
        boolean is_hazardous
        boolean requires_signature
        text[] item_images
        varchar pickup_address
        geography pickup_coordinates
        varchar pickup_contact_name
        varchar pickup_contact_phone
        text pickup_instructions
        timestamp pickup_time_start
        timestamp pickup_time_end
        boolean flexible_pickup_timing
        text[] preferred_pickup_days
        varchar delivery_address
        geography delivery_coordinates
        varchar delivery_contact_name
        varchar delivery_contact_phone
        text delivery_instructions
        timestamp delivery_time_start
        timestamp delivery_time_end
        boolean requires_recipient_presence
        decimal max_price
        decimal auto_accept_price
        decimal estimated_price
        uuid[] preferred_travelers
        uuid[] blacklisted_travelers
        decimal min_traveler_rating
        boolean verification_required
        boolean insurance_required
        boolean background_check_required
        jsonb notification_preferences
        text special_instructions
        text[] tags
        timestamp created_at
        timestamp updated_at
        timestamp expires_at
        timestamp cancelled_at
        text cancellation_reason
    }

    DELIVERY_OFFERS {
        uuid id PK
        uuid delivery_request_id FK
        uuid traveler_id FK
        uuid trip_id FK
        decimal price
        text message
        timestamp estimated_pickup_time
        timestamp estimated_delivery_time
        offer_status_enum status
        jsonb guarantees
        jsonb special_services
        timestamp valid_until
        timestamp created_at
        timestamp updated_at
        timestamp accepted_at
        timestamp declined_at
        text declined_reason
    }

    DELIVERIES {
        uuid id PK
        uuid delivery_request_id FK
        uuid offer_id FK
        uuid customer_id FK
        uuid traveler_id FK
        uuid trip_id FK
        varchar delivery_number UK
        delivery_status_enum status
        decimal final_price
        text special_requests
        timestamp accepted_at
        timestamp pickup_scheduled_at
        timestamp pickup_completed_at
        timestamp in_transit_at
        timestamp delivery_scheduled_at
        timestamp delivery_completed_at
        timestamp cancelled_at
        text cancellation_reason
        uuid cancelled_by FK
        jsonb pickup_verification
        jsonb delivery_verification
        varchar recipient_signature_url
        varchar delivery_photo_url
        text delivery_notes
        timestamp created_at
        timestamp updated_at
    }

    %% ============================
    %% QR CODE SERVICE TABLES (qr_db)
    %% ============================
    QR_CODES {
        uuid id PK
        uuid delivery_id FK
        qr_type_enum qr_type
        text encrypted_data
        text image_data
        varchar download_url
        varchar backup_code
        security_level_enum security_level
        jsonb security_features
        timestamp expires_at
        timestamp used_at
        qr_status_enum status
        boolean location_bound
        geography bound_coordinates
        integer bound_radius
        timestamp created_at
        timestamp revoked_at
        text revoked_reason
    }

    QR_CODE_SCANS {
        uuid id PK
        uuid qr_code_id FK
        uuid scanned_by FK
        scan_result_enum scan_result
        geography scan_location
        jsonb device_info
        jsonb additional_verification
        text failure_reason
        timestamp scanned_at
    }

    QR_EMERGENCY_OVERRIDES {
        uuid id PK
        uuid delivery_id FK
        uuid qr_code_id FK
        text override_reason
        jsonb alternative_verification
        uuid requested_by FK
        uuid approved_by FK
        varchar alternative_code
        timestamp valid_until
        timestamp used_at
        timestamp created_at
    }

    %% ============================
    %% PAYMENT SERVICE TABLES (payment_db)
    %% ============================
    PAYMENT_INTENTS {
        uuid id PK
        uuid delivery_id FK
        varchar stripe_payment_intent_id UK
        integer amount
        varchar currency
        payment_status_enum status
        varchar payment_method_id
        varchar client_secret
        integer platform_fee
        integer processing_fee
        integer insurance_fee
        integer total_fees
        jsonb metadata
        timestamp created_at
        timestamp updated_at
        timestamp confirmed_at
        timestamp failed_at
        text failure_reason
    }

    ESCROW_ACCOUNTS {
        uuid id PK
        uuid payment_intent_id FK
        uuid delivery_id FK
        integer amount
        varchar currency
        escrow_status_enum status
        timestamp hold_until
        varchar release_condition
        boolean auto_release_enabled
        timestamp released_at
        integer released_amount
        text release_reason
        timestamp created_at
        timestamp updated_at
    }

    PAYOUT_ACCOUNTS {
        uuid id PK
        uuid user_id FK
        varchar stripe_account_id UK
        varchar account_type
        varchar country
        varchar currency
        payout_account_status_enum status
        jsonb capabilities
        jsonb requirements
        varchar verification_status
        jsonb verification_details
        integer balance_available
        integer balance_pending
        jsonb payout_schedule
        timestamp created_at
        timestamp updated_at
        timestamp verified_at
    }

    PAYOUTS {
        uuid id PK
        uuid user_id FK
        uuid payout_account_id FK
        varchar stripe_payout_id
        integer amount
        varchar currency
        payout_type_enum type
        payout_status_enum status
        integer fee
        integer net_amount
        text description
        jsonb metadata
        timestamp created_at
        timestamp updated_at
        timestamp paid_at
        timestamp failed_at
        text failure_reason
    }

    REFUNDS {
        uuid id PK
        uuid payment_intent_id FK
        varchar stripe_refund_id UK
        integer amount
        varchar currency
        refund_reason_enum reason
        refund_status_enum status
        integer customer_refund
        integer traveler_compensation
        integer platform_fee_refund
        text description
        jsonb metadata
        timestamp created_at
        timestamp updated_at
        timestamp processed_at
    }

    PRICING_FACTORS {
        uuid id PK
        varchar route_hash
        item_category_enum item_category
        urgency_level_enum urgency
        decimal base_price
        decimal distance_multiplier
        decimal weight_multiplier
        decimal urgency_multiplier
        decimal category_multiplier
        decimal demand_multiplier
        jsonb market_data
        timestamp effective_from
        timestamp effective_until
        timestamp created_at
    }

    PROMOTIONAL_CREDITS {
        uuid id PK
        uuid user_id FK
        varchar code UK
        credit_type_enum type
        integer amount
        varchar currency
        credit_status_enum status
        text description
        jsonb conditions
        timestamp expires_at
        timestamp used_at
        uuid used_in_payment FK
        timestamp created_at
    }

    SUBSCRIPTIONS {
        uuid id PK
        uuid user_id FK
        varchar stripe_subscription_id UK
        varchar plan_id
        varchar plan_name
        subscription_status_enum status
        timestamp current_period_start
        timestamp current_period_end
        integer price
        varchar currency
        subscription_interval_enum interval
        timestamp trial_start
        timestamp trial_end
        timestamp canceled_at
        text cancellation_reason
        timestamp created_at
        timestamp updated_at
    }

    %% ============================
    %% LOCATION SERVICE TABLES (location_db)
    %% ============================
    LOCATION_TRACKING {
        uuid id PK
        uuid delivery_id FK
        uuid user_id FK
        geography coordinates
        decimal accuracy
        decimal altitude
        decimal bearing
        decimal speed
        integer battery_level
        varchar network_type
        timestamp timestamp
        timestamp created_at
    }

    GEOFENCES {
        uuid id PK
        varchar name
        geofence_type_enum type
        uuid delivery_id FK
        geometry_type_enum geometry_type
        geography center_coordinates
        integer radius
        geography polygon_coordinates
        jsonb notifications
        boolean active
        timestamp start_time
        timestamp end_time
        varchar timezone
        jsonb metadata
        timestamp created_at
        timestamp updated_at
    }

    GEOFENCE_EVENTS {
        uuid id PK
        uuid geofence_id FK
        uuid user_id FK
        uuid delivery_id FK
        geofence_event_type_enum event_type
        geography coordinates
        integer dwell_time
        timestamp triggered_at
    }

    ROUTE_OPTIMIZATIONS {
        uuid id PK
        uuid delivery_id FK
        geography origin_coordinates
        geography destination_coordinates
        jsonb waypoints
        jsonb optimized_route
        decimal total_distance
        integer total_duration
        decimal total_detour
        decimal fuel_cost
        decimal toll_cost
        jsonb traffic_conditions
        jsonb alternatives
        timestamp created_at
        timestamp expires_at
    }

    EMERGENCY_LOCATIONS {
        uuid id PK
        uuid delivery_id FK
        uuid user_id FK
        emergency_type_enum emergency_type
        geography coordinates
        decimal accuracy
        text description
        varchar contact_number
        boolean requires_assistance
        emergency_severity_enum severity
        emergency_status_enum status
        timestamp resolved_at
        text resolution_notes
        timestamp created_at
    }

    %% ============================
    %% NOTIFICATION SERVICE TABLES (notification_db)
    %% ============================
    NOTIFICATION_TEMPLATES {
        uuid id PK
        varchar name UK
        text description
        notification_category_enum category
        jsonb push_template
        jsonb email_template
        jsonb sms_template
        jsonb in_app_template
        jsonb variables
        jsonb targeting
        template_status_enum status
        integer version
        timestamp created_at
        timestamp updated_at
        uuid created_by FK
    }

    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK
        uuid template_id FK
        notification_type_enum notification_type
        notification_category_enum category
        varchar title
        text message
        jsonb push_data
        jsonb email_data
        jsonb sms_data
        jsonb in_app_data
        notification_status_enum status
        notification_priority_enum priority
        timestamp sent_at
        timestamp delivered_at
        timestamp read_at
        timestamp clicked_at
        varchar external_id
        text failure_reason
        uuid delivery_id FK
        uuid trip_id FK
        jsonb metadata
    }

    NOTIFICATION_PREFERENCES {
        uuid id PK
        uuid user_id FK
        boolean push_enabled
        jsonb push_categories
        jsonb push_quiet_hours
        boolean email_enabled
        jsonb email_categories
        varchar email_frequency
        boolean sms_enabled
        jsonb sms_categories
        boolean in_app_enabled
        jsonb in_app_categories
        varchar language
        varchar timezone
        timestamp created_at
        timestamp updated_at
    }

    DEVICE_TOKENS {
        uuid id PK
        uuid user_id FK
        varchar token
        platform_enum platform
        varchar device_id
        varchar app_version
        boolean active
        timestamp last_used_at
        timestamp created_at
        timestamp updated_at
    }

    BULK_NOTIFICATIONS {
        uuid id PK
        uuid template_id FK
        bulk_operation_enum operation
        bulk_status_enum status
        integer total_recipients
        integer processed_count
        integer successful_count
        integer failed_count
        integer batch_size
        integer delay_between_batches
        timestamp scheduled_at
        timestamp started_at
        timestamp completed_at
        timestamp created_at
        uuid created_by FK
    }

    NOTIFICATION_WEBHOOKS {
        uuid id PK
        varchar url
        text[] events
        varchar secret
        boolean active
        jsonb filters
        timestamp created_at
        timestamp updated_at
        timestamp last_triggered_at
        integer total_attempts
        integer successful_attempts
        integer failed_attempts
    }

    %% ============================
    %% ADMIN SERVICE TABLES (admin_db)
    %% ============================
    ADMIN_USERS {
        uuid id PK
        uuid user_id FK
        admin_role_enum role
        text[] permissions
        boolean is_active
        timestamp last_login_at
        timestamp created_at
        timestamp updated_at
        uuid created_by FK
    }

    ADMIN_ACTIVITY_LOG {
        uuid id PK
        uuid admin_id FK
        varchar action
        varchar resource_type
        uuid resource_id
        text description
        jsonb details
        inet ip_address
        text user_agent
        timestamp created_at
    }

    SYSTEM_CONFIGURATION {
        uuid id PK
        varchar category
        varchar key
        jsonb value
        text description
        boolean is_sensitive
        boolean requires_restart
        uuid updated_by FK
        timestamp updated_at
    }

    SYSTEM_BACKUPS {
        uuid id PK
        backup_type_enum backup_type
        backup_status_enum status
        bigint size_bytes
        varchar file_path
        varchar download_url
        text description
        boolean include_uploads
        boolean include_logs
        timestamp started_at
        timestamp completed_at
        timestamp expires_at
        uuid created_by FK
    }

    DATA_EXPORTS {
        uuid id PK
        varchar export_type
        export_format_enum format
        export_status_enum status
        jsonb filters
        text[] fields
        integer estimated_records
        integer actual_records
        bigint file_size_bytes
        varchar download_url
        timestamp expires_at
        uuid requested_by FK
        timestamp created_at
        timestamp completed_at
    }

    DISPUTES {
        uuid id PK
        uuid delivery_id FK
        uuid payment_intent_id FK
        varchar case_number UK
        dispute_category_enum category
        dispute_priority_enum priority
        dispute_status_enum status
        uuid complainant_id FK
        uuid respondent_id FK
        integer amount
        varchar currency
        text description
        dispute_resolution_enum requested_resolution
        uuid assignee_id FK
        timestamp assigned_at
        timestamp created_at
        timestamp updated_at
        timestamp due_date
        timestamp resolved_at
        text resolution_notes
    }

    DISPUTE_EVIDENCE {
        uuid id PK
        uuid dispute_id FK
        uuid submitted_by FK
        evidence_type_enum evidence_type
        varchar file_url
        text description
        timestamp created_at
    }

    DISPUTE_MESSAGES {
        uuid id PK
        uuid dispute_id FK
        uuid sender_id FK
        text message
        boolean is_internal
        timestamp created_at
    }

    DAILY_METRICS {
        uuid id PK
        date date
        varchar metric_type
        integer new_users
        integer active_users
        integer deleted_users
        integer new_requests
        integer matched_requests
        integer completed_deliveries
        integer cancelled_deliveries
        decimal total_revenue
        decimal platform_fees
        decimal refunds
        integer average_response_time
        decimal success_rate
        integer api_calls
        integer errors
        timestamp created_at
    }

    POPULAR_ROUTES {
        uuid id PK
        varchar route_hash
        varchar origin_city
        varchar destination_city
        varchar origin_country
        varchar destination_country
        integer request_count
        decimal average_price
        decimal total_distance
        date date
        timestamp created_at
    }

    %% ============================
    %% RELATIONSHIPS
    %% ============================
    
    %% Authentication Service Relationships
    USERS ||--o{ USER_SESSIONS : "has"
    USERS ||--o{ USER_TWO_FACTOR_AUTH : "has"
    USERS ||--o{ PASSWORD_RESET_TOKENS : "has"
    USERS ||--o{ EMAIL_VERIFICATION_TOKENS : "has"

    %% User Management Service Relationships
    USERS ||--o{ USER_ADDRESSES : "has"
    USERS ||--|| USER_PREFERENCES : "has"
    USERS ||--|| USER_STATISTICS : "has"
    USERS ||--o{ USER_VERIFICATION_DOCUMENTS : "has"
    USERS ||--o{ REVIEWS : "writes"
    USERS ||--o{ USER_BLOCKS : "blocks"
    USERS ||--o{ USER_FAVORITES : "favorites"
    USERS ||--o{ USER_REPORTS : "reports"
    REVIEWS ||--o{ REVIEW_REPORTS : "reported"

    %% Trip Management Service Relationships
    USERS ||--o{ TRIPS : "creates"
    USERS ||--o{ TRIP_TEMPLATES : "creates"
    TRIPS ||--o{ TRIP_WEATHER : "has"

    %% Delivery Request Service Relationships
    USERS ||--o{ DELIVERY_REQUESTS : "creates"
    USERS ||--o{ DELIVERY_OFFERS : "makes"
    USERS ||--o{ DELIVERIES : "participates"
    TRIPS ||--o{ DELIVERY_OFFERS : "associated"
    TRIPS ||--o{ DELIVERIES : "associated"
    DELIVERY_REQUESTS ||--o{ DELIVERY_OFFERS : "receives"
    DELIVERY_REQUESTS ||--|| DELIVERIES : "becomes"
    DELIVERY_OFFERS ||--|| DELIVERIES : "becomes"

    %% QR Code Service Relationships
    DELIVERIES ||--o{ QR_CODES : "has"
    QR_CODES ||--o{ QR_CODE_SCANS : "scanned"
    DELIVERIES ||--o{ QR_EMERGENCY_OVERRIDES : "has"

    %% Payment Service Relationships
    DELIVERIES ||--|| PAYMENT_INTENTS : "has"
    PAYMENT_INTENTS ||--|| ESCROW_ACCOUNTS : "creates"
    PAYMENT_INTENTS ||--o{ REFUNDS : "refunded"
    USERS ||--o{ PAYOUT_ACCOUNTS : "has"
    USERS ||--o{ PAYOUTS : "receives"
    USERS ||--o{ PROMOTIONAL_CREDITS : "has"
    USERS ||--o{ SUBSCRIPTIONS : "has"

    %% Location Service Relationships
    DELIVERIES ||--o{ LOCATION_TRACKING : "tracked"
    DELIVERIES ||--o{ GEOFENCES : "has"
    GEOFENCES ||--o{ GEOFENCE_EVENTS : "triggers"
    DELIVERIES ||--o{ ROUTE_OPTIMIZATIONS : "optimized"
    DELIVERIES ||--o{ EMERGENCY_LOCATIONS : "emergency"

    %% Notification Service Relationships
    USERS ||--o{ NOTIFICATIONS : "receives"
    USERS ||--|| NOTIFICATION_PREFERENCES : "has"
    USERS ||--o{ DEVICE_TOKENS : "has"
    NOTIFICATION_TEMPLATES ||--o{ NOTIFICATIONS : "generates"
    NOTIFICATION_TEMPLATES ||--o{ BULK_NOTIFICATIONS : "uses"

    %% Admin Service Relationships
    USERS ||--o{ ADMIN_USERS : "admin"
    ADMIN_USERS ||--o{ ADMIN_ACTIVITY_LOG : "performs"
    DELIVERIES ||--o{ DISPUTES : "disputed"
    PAYMENT_INTENTS ||--o{ DISPUTES : "disputed"
    DISPUTES ||--o{ DISPUTE_EVIDENCE : "has"
    DISPUTES ||--o{ DISPUTE_MESSAGES : "has"
```

## Microservice Architecture and Table Distribution

### 1. Authentication Service (Port 3001) - 5 tables

**Database:** `auth_db`
**Responsibility:** User authentication, authorization, and session management

**Core Tables:**
- `users` - Primary user accounts and basic authentication information
- `user_sessions` - Device sessions and authentication tokens
- `user_two_factor_auth` - Two-factor authentication settings and backup codes
- `password_reset_tokens` - Password reset token management
- `email_verification_tokens` - Email verification process and tokens

**Key Features:**
- JWT-based authentication with refresh tokens
- Two-factor authentication (TOTP)
- Social login integration (Google, Facebook, Apple)
- Device and session management
- Password reset and email verification

### 2. User Management Service (Port 3002) - 9 tables

**Database:** `user_db`
**Responsibility:** User profiles, verification, ratings, and user relationships

**Core Tables:**
- `user_addresses` - User addresses for pickup/delivery locations
- `user_preferences` - User settings and notification preferences
- `user_statistics` - Aggregated user performance metrics and analytics
- `user_verification_documents` - Identity verification documents and status
- `reviews` - User reviews and ratings system
- `review_reports` - Review moderation and reporting system
- `user_blocks` - User blocking relationships for safety
- `user_favorites` - Preferred traveler relationships
- `user_reports` - User behavior reports and moderation

**Key Features:**
- Dual-role user system (Customer/Traveler/Both)
- Identity verification with document upload
- Rating and review system
- Address management with geocoding
- User relationship management

### 3. Trip Management Service (Port 3003) - 3 tables

**Database:** `trip_db`
**Responsibility:** Travel itineraries, capacity management, and route optimization

**Core Tables:**
- `trips` - Travel itineraries with dynamic capacity management
- `trip_templates` - Reusable trip configurations for frequent routes
- `trip_weather` - Cached weather data and travel condition alerts

**Key Features:**
- Multi-modal transportation support (flight, train, bus, car)
- Dynamic capacity tracking (weight, volume, items)
- Route optimization with traffic integration
- Recurring trip templates
- Weather integration and alerts

### 4. Delivery Request Service (Port 3004) - 3 tables

**Database:** `delivery_db`
**Responsibility:** Delivery requests, AI matching, and delivery lifecycle

**Core Tables:**
- `delivery_requests` - Customer requests for item delivery
- `delivery_offers` - Traveler offers for delivery requests
- `deliveries` - Active delivery tracking and management

**Key Features:**
- AI-powered matching algorithm
- Real-time offer system
- Compatibility scoring with 15+ factors
- Market analysis and pricing recommendations
- Delivery lifecycle management

### 5. QR Code Service (Port 3006) - 3 tables

**Database:** `qr_db`
**Responsibility:** Secure verification system for pickup and delivery

**Core Tables:**
- `qr_codes` - Encrypted QR codes for pickup/delivery verification
- `qr_code_scans` - Scan history and validation attempts
- `qr_emergency_overrides` - Emergency backup verification codes

**Key Features:**
- Military-grade encryption (AES-256)
- Time and location-based expiration
- Blockchain-based verification (optional)
- Emergency override capabilities
- Comprehensive audit trails

### 6. Payment Service (Port 3007) - 8 tables

**Database:** `payment_db`
**Responsibility:** Dynamic pricing, payments, escrow, and financial operations

**Core Tables:**
- `payment_intents` - Stripe payment intent management
- `escrow_accounts` - Secure payment holding until delivery completion
- `payout_accounts` - Traveler payout account management
- `payouts` - Payment distributions to travelers
- `refunds` - Refund processing and tracking
- `pricing_factors` - Dynamic pricing algorithms and market data
- `promotional_credits` - User credits and promotional campaigns
- `subscriptions` - Premium subscription management

**Key Features:**
- Dynamic pricing engine with 15+ factors
- Escrow-based payment protection
- Multi-currency support
- Instant and standard payouts
- Fraud prevention and compliance

### 7. Location Service (Port 3008) - 5 tables

**Database:** `location_db`
**Responsibility:** Real-time tracking, geofencing, and location-based services

**Core Tables:**
- `location_tracking` - GPS tracking data with privacy controls
- `geofences` - Pickup/delivery zone definitions
- `geofence_events` - Geofence entry/exit event tracking
- `route_optimizations` - Optimized routing data and alternatives
- `emergency_locations` - Emergency location services and incident management

**Key Features:**
- High-precision GPS tracking with offline sync
- Smart geofencing with contextual triggers
- Route optimization with traffic integration
- Emergency services integration
- Privacy-controlled location sharing

### 8. Notification Service (Port 3009) - 6 tables

**Database:** `notification_db`
**Responsibility:** Multi-channel notification delivery and template management

**Core Tables:**
- `notification_templates` - Reusable notification templates with variables
- `notifications` - Sent notifications tracking and analytics
- `notification_preferences` - User notification settings and quiet hours
- `device_tokens` - Push notification device tokens
- `bulk_notifications` - Bulk notification campaigns and operations
- `notification_webhooks` - External webhook configurations

**Key Features:**
- Multi-channel delivery (push, email, SMS, in-app)
- Template system with personalization
- Smart delivery timing optimization
- Bulk notification campaigns
- Webhook integrations

### 9. Admin Service (Port 3010) - 11 tables

**Database:** `admin_db`
**Responsibility:** Administrative operations, monitoring, and system management

**Core Tables:**
- `admin_users` - Administrative user accounts with role-based permissions
- `admin_activity_log` - Complete administrative action audit trail
- `system_configuration` - System settings and feature flags
- `system_backups` - Backup management and recovery
- `data_exports` - Data export request tracking
- `disputes` - Dispute cases and resolution management
- `dispute_evidence` - Evidence files and documents for disputes
- `dispute_messages` - Dispute communication threads
- `daily_metrics` - Aggregated daily performance metrics
- `popular_routes` - Popular route analytics and insights

**Key Features:**
- Real-time system monitoring dashboard
- User and delivery management tools
- Financial reporting and analytics
- Dispute resolution system
- Content moderation capabilities
- System configuration management

## Complete Database Architecture Summary

### Total Tables: 52 across 9 Microservices

| Service | Port | Database | Tables | Primary Responsibilities |
|---------|------|----------|--------|-------------------------|
| **Authentication** | 3001 | `auth_db` | 5 | User auth, sessions, 2FA, password/email verification |
| **User Management** | 3002 | `user_db` | 9 | Profiles, addresses, preferences, statistics, reviews, relationships |
| **Trip Management** | 3003 | `trip_db` | 3 | Travel itineraries, templates, weather integration |
| **Delivery Request** | 3004 | `delivery_db` | 3 | Delivery requests, offers, matching, delivery lifecycle |
| **QR Code** | 3006 | `qr_db` | 3 | Secure verification, encrypted QR codes, emergency overrides |
| **Payment** | 3007 | `payment_db` | 8 | Dynamic pricing, payments, escrow, payouts, subscriptions |
| **Location** | 3008 | `location_db` | 5 | GPS tracking, geofencing, route optimization, emergency |
| **Notification** | 3009 | `notification_db` | 6 | Multi-channel notifications, templates, preferences |
| **Admin** | 3010 | `admin_db` | 10 | System monitoring, user management, disputes, analytics |

### Database Distribution by Service

#### Authentication Service (5 tables)
1. `users` - Core user authentication data
2. `user_sessions` - Device sessions and tokens
3. `user_two_factor_auth` - 2FA configuration
4. `password_reset_tokens` - Password recovery
5. `email_verification_tokens` - Email verification

#### User Management Service (9 tables)
1. `user_addresses` - User location data
2. `user_preferences` - Settings and preferences
3. `user_statistics` - Performance metrics
4. `user_verification_documents` - Identity verification
5. `reviews` - Rating and review system
6. `review_reports` - Review moderation reports
7. `user_blocks` - User blocking system
8. `user_favorites` - Preferred travelers
9. `user_reports` - User behavior reports

#### Trip Management Service (3 tables)
1. `trips` - Travel itineraries and capacity
2. `trip_templates` - Reusable trip patterns
3. `trip_weather` - Weather data and alerts

#### Delivery Request Service (3 tables)
1. `delivery_requests` - Customer delivery requests
2. `delivery_offers` - Traveler offers
3. `deliveries` - Active delivery tracking

#### QR Code Service (3 tables)
1. `qr_codes` - Encrypted verification codes
2. `qr_code_scans` - Scan history and validation
3. `qr_emergency_overrides` - Emergency access codes

#### Payment Service (8 tables)
1. `payment_intents` - Payment processing
2. `escrow_accounts` - Secure fund holding
3. `payout_accounts` - Traveler payout accounts
4. `payouts` - Payment distributions
5. `refunds` - Refund processing
6. `pricing_factors` - Dynamic pricing data
7. `promotional_credits` - User credits and promos
8. `subscriptions` - Premium subscriptions

#### Location Service (5 tables)
1. `location_tracking` - GPS tracking data
2. `geofences` - Location boundaries
3. `geofence_events` - Boundary crossing events
4. `route_optimizations` - Optimized routes
5. `emergency_locations` - Emergency incidents

#### Notification Service (6 tables)
1. `notification_templates` - Message templates
2. `notifications` - Sent notification tracking
3. `notification_preferences` - User preferences
4. `device_tokens` - Push notification tokens
5. `bulk_notifications` - Mass notification campaigns
6. `notification_webhooks` - External integrations

#### Admin Service (10 tables)
1. `admin_users` - Administrative accounts
2. `admin_activity_log` - Admin action audit trail
3. `system_configuration` - System settings
4. `system_backups` - Backup management
5. `data_exports` - Data export tracking
6. `disputes` - Dispute management
7. `dispute_evidence` - Dispute evidence files
8. `dispute_messages` - Dispute communications
9. `daily_metrics` - Aggregated metrics
10. `popular_routes` - Route analytics

## Key Design Patterns

### 1. Soft Deletes
- `users.deleted_at` - Users are soft deleted to maintain referential integrity
- Historical data remains accessible for analytics and audit purposes

### 2. Audit Trails
- All major tables include `created_at` and `updated_at` timestamps
- Admin actions are logged in `admin_activity_log`
- QR code usage is tracked in `qr_code_scans`
- Payment transactions maintain complete history

### 3. Status Tracking
- Comprehensive status enums for all major entities
- State machine-like progression through defined statuses
- Historical status changes can be tracked

### 4. Geospatial Data
- PostGIS integration for location-based features
- Efficient spatial indexing for proximity searches
- Support for both point and polygon geometries

### 5. JSONB Flexibility
- Structured data in JSONB columns for extensibility
- Maintains queryability while allowing schema evolution
- Used for metadata, preferences, and configuration

### 6. Referential Integrity
- Comprehensive foreign key relationships
- Cascade deletes where appropriate
- Constraint checks for data validation

### 7. Performance Optimization
- Strategic indexing for common query patterns
- Materialized views for complex aggregations
- Partitioning support for high-volume tables

## Comprehensive Data Flow Examples

### 1. User Registration Flow (Authentication Service)
```
Authentication Service (Port 3001):
1. POST /api/v1/auth/register → Insert into `users` table
2. Generate email verification → Insert into `email_verification_tokens`
3. Create user session → Insert into `user_sessions`

User Management Service (Port 3002):
4. Trigger user profile creation → Insert into `user_statistics` (via event)
5. Create default preferences → Insert into `user_preferences`

Notification Service (Port 3009):
6. Send verification email → Insert into `notifications`
7. Register device token → Insert into `device_tokens`
```

### 2. Trip Creation Flow (Trip Management Service)
```
Trip Management Service (Port 3003):
1. POST /api/v1/trips → Insert into `trips` table
2. Geocode addresses → Update `trips` with coordinates
3. Fetch weather data → Insert into `trip_weather`
4. Create from template (optional) → Update `trip_templates` usage

Location Service (Port 3008):
5. Create pickup geofence → Insert into `geofences`
6. Create delivery geofence → Insert into `geofences`

Notification Service (Port 3009):
7. Notify followers → Insert into `notifications`
```

### 3. Delivery Request and Matching Flow
```
Delivery Request Service (Port 3004):
1. POST /api/v1/delivery-requests → Insert into `delivery_requests`
2. AI matching algorithm → Query `trips` with geospatial constraints
3. Generate price recommendations → Query `pricing_factors`

Trip Management Service (Port 3003):
4. Find compatible trips → Spatial queries on `trips` table
5. Check capacity availability → Update `trips` available capacity

Notification Service (Port 3009):
6. Notify potential travelers → Insert into `notifications`
7. Send real-time updates → WebSocket notifications
```

### 4. Offer Submission and Acceptance Flow
```
Delivery Request Service (Port 3004):
1. POST /api/v1/delivery-requests/:id/offers → Insert into `delivery_offers`
2. Check auto-acceptance criteria → Query `delivery_requests`
3. Customer accepts offer → Update `delivery_offers` status
4. Create delivery record → Insert into `deliveries`

Payment Service (Port 3007):
5. Create payment intent → Insert into `payment_intents`
6. Process payment → Update `payment_intents` status
7. Create escrow account → Insert into `escrow_accounts`

QR Code Service (Port 3006):
8. Generate pickup QR code → Insert into `qr_codes`
9. Generate delivery QR code → Insert into `qr_codes`

Notification Service (Port 3009):
10. Notify all parties → Insert into `notifications`
```

### 5. Active Delivery Tracking Flow
```
QR Code Service (Port 3006):
1. Traveler scans pickup QR → Insert into `qr_code_scans`
2. Validate QR code → Update `qr_codes` status
3. Update delivery status → Update `deliveries` (pickup_completed_at)

Location Service (Port 3008):
4. Start location tracking → Insert into `location_tracking`
5. Monitor geofences → Insert into `geofence_events`
6. Optimize route → Insert into `route_optimizations`

Notification Service (Port 3009):
7. Send status updates → Insert into `notifications`
8. Real-time location sharing → WebSocket updates

Admin Service (Port 3010):
9. Track metrics → Update `daily_metrics`
```

### 6. Delivery Completion Flow
```
QR Code Service (Port 3006):
1. Scan delivery QR → Insert into `qr_code_scans`
2. Validate and complete → Update `qr_codes` status
3. Update delivery status → Update `deliveries` (delivery_completed_at)

Payment Service (Port 3007):
4. Release escrow funds → Update `escrow_accounts`
5. Process traveler payout → Insert into `payouts`
6. Update payout account → Update `payout_accounts` balance

User Management Service (Port 3002):
7. Trigger review requests → Update `user_statistics`
8. Submit reviews → Insert into `reviews`

Location Service (Port 3008):
9. Stop location tracking → Final insert into `location_tracking`
10. Archive location data → Privacy cleanup process

Notification Service (Port 3009):
11. Send completion notifications → Insert into `notifications`
12. Trigger webhooks → Update `notification_webhooks` stats
```

### 7. Dispute Resolution Flow
```
Admin Service (Port 3010):
1. Create dispute → Insert into `disputes`
2. Upload evidence → Insert into `dispute_evidence`
3. Admin communication → Insert into `dispute_messages`
4. Assign to admin → Update `disputes` assignee
5. Log admin actions → Insert into `admin_activity_log`

Payment Service (Port 3007):
6. Process refund → Insert into `refunds`
7. Update escrow → Update `escrow_accounts`
8. Adjust payouts → Update `payouts` or `payout_accounts`

Notification Service (Port 3009):
9. Notify all parties → Insert into `notifications`
10. Send resolution updates → Template-based notifications

User Management Service (Port 3002):
11. Update user statistics → Update `user_statistics`
12. Impact on ratings → Recalculate `reviews` aggregations
```

### 8. Emergency Response Flow
```
Location Service (Port 3008):
1. Report emergency → Insert into `emergency_locations`
2. Get current location → Query `location_tracking`
3. Find nearby services → Geospatial queries

Admin Service (Port 3010):
4. Alert administrators → Insert into `admin_activity_log`
5. Track response → Update `emergency_locations` status

QR Code Service (Port 3006):
6. Request emergency override → Insert into `qr_emergency_overrides`
7. Admin approval → Update `qr_emergency_overrides`

Notification Service (Port 3009):
8. Send emergency alerts → Insert into `notifications` (urgent priority)
9. SMS/call notifications → Multi-channel delivery
```

### 9. Financial Reporting Flow
```
Admin Service (Port 3010):
1. Request financial report → Insert into `data_exports`
2. Aggregate daily metrics → Query `daily_metrics`
3. Generate report → Update `data_exports` with download URL

Payment Service (Port 3007):
4. Query payment data → Aggregate from `payment_intents`, `payouts`, `refunds`
5. Calculate fees → Sum from `payment_intents` fee columns
6. Analyze trends → Query `pricing_factors` for market data

User Management Service (Port 3002):
7. User performance data → Query `user_statistics`
8. Top performers → Query `reviews` for ratings

Trip Management Service (Port 3003):
9. Route analytics → Query `trips` for popular routes
10. Update route insights → Insert/update `popular_routes`
```

## Scalability Considerations

### 1. High-Volume Tables
- `location_tracking` - Consider partitioning by date
- `notifications` - Consider partitioning by date
- `admin_activity_log` - Consider partitioning by date

### 2. Read Replicas
- Analytics queries can use read replicas
- Location tracking reads can use read replicas
- Notification delivery can use read replicas

### 3. Caching Strategy
- User profiles frequently accessed
- Active delivery data needs real-time access
- Trip search results can be cached

### 4. Archive Strategy
- Old location tracking data can be archived
- Completed deliveries can be moved to archive tables
- Old notifications can be purged

## Microservice-Database Mapping Summary

### Complete Table Distribution Verification

✅ **All 52 Tables Included:**
- Authentication Service: 5 tables
- User Management Service: 9 tables
- Trip Management Service: 3 tables
- Delivery Request Service: 3 tables
- QR Code Service: 3 tables
- Payment Service: 8 tables
- Location Service: 5 tables
- Notification Service: 6 tables
- Admin Service: 10 tables

**Total: 52 tables** (matching database_design.sql)

### Inter-Service Communication Patterns

#### Primary Data Flows:
1. **User Registration** → Authentication → User Management → Notification
2. **Trip Creation** → Trip Management → Location → Notification
3. **Delivery Request** → Delivery Request → Trip Management → Notification
4. **Offer & Acceptance** → Delivery Request → Payment → QR Code → Notification
5. **Active Delivery** → QR Code → Location → Notification → Admin
6. **Completion** → QR Code → Payment → User Management → Location → Notification
7. **Dispute Resolution** → Admin → Payment → Notification → User Management
8. **Emergency Response** → Location → Admin → QR Code → Notification

#### Key Integration Points:
- **Users table**: Shared reference across all services
- **Deliveries table**: Central hub for delivery lifecycle
- **Notifications**: Cross-cutting concern for all services
- **Admin Activity Log**: Audit trail for all administrative actions

### Database Consistency Features

#### Cross-Service Referential Integrity:
- Foreign key relationships maintained through service APIs
- Event-driven consistency for non-critical data
- Strong consistency for financial and security operations
- Saga pattern for complex multi-service transactions

#### Performance Optimization:
- Service-specific database optimization
- Strategic indexing for geospatial and temporal queries
- Caching layers for frequently accessed data
- Read replicas for analytics and reporting

#### Security & Privacy:
- Service-level data encryption
- GDPR compliance with data anonymization
- Audit trails across all services
- Role-based access control

This comprehensive database design provides a solid foundation for an enterprise-level P2P delivery platform with full support for all features described in the API documentation, complete microservice separation, and consistent data architecture across all 9 services.