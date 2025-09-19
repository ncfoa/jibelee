# P2P Delivery Platform - Complete API Documentation

## 📋 Table of Contents

1. [Authentication Service API](#authentication-service-api)
2. [User Management Service API](#user-management-service-api)  
3. [Trip Management Service API](#trip-management-service-api)
4. [Delivery Request Service API](#delivery-request-service-api)
5. [QR Code Service API](#qr-code-service-api)
6. [Payment Service API](#payment-service-api)
7. [Location Service API](#location-service-api)
8. [Notification Service API](#notification-service-api)
9. [Admin Service API](#admin-service-api)

---

## 🚀 Complete API Routes Reference

### Authentication Service API (`/api/v1/auth`)
- **POST** `/register` - [User Registration](#1-user-registration)
- **POST** `/verify-email` - [Email Verification](#2-email-verification)
- **POST** `/login` - [User Login](#3-login)
- **POST** `/social-login` - [Social Login](#4-social-login)
- **POST** `/2fa/setup` - [Two-Factor Authentication Setup](#5-two-factor-authentication-setup)
- **POST** `/refresh` - [Refresh Token](#6-refresh-token)
- **POST** `/logout` - [User Logout](#7-logout)
- **POST** `/forgot-password` - [Forgot Password](#8-forgot-password)
- **POST** `/reset-password` - [Reset Password](#9-reset-password)
- **POST** `/change-password` - [Change Password](#10-change-password)
- **GET** `/validate` - [Validate Token](#11-validate-token)
- **POST** `/resend-verification` - [Resend Verification Code](#12-resend-verification-code)

#### Account Management (`/api/v1/auth/account`)
- **POST** `/reactivate` - [Reactivate Account](#1-reactivate-account)
- **GET** `/status` - [Get Account Status](#2-get-account-status)
- **PATCH** `/settings` - [Update Account Settings](#3-update-account-settings)
- **GET** `/export` - [Export Account Data](#4-export-account-data)
- **GET** `/security-log` - [Get Security Log](#5-get-security-log)
- **POST** `/deactivate` - [Deactivate Account](#6-deactivate-account)
- **DELETE** `/` - [Delete Account](#7-delete-account)

#### Session Management (`/api/v1/auth/sessions`)
- **GET** `/` - [Get User Sessions](#1-get-user-sessions)
- **GET** `/current` - [Get Current Session](#2-get-current-session)
- **GET** `/stats` - [Get Session Statistics](#3-get-session-statistics)
- **GET** `/suspicious` - [Check Suspicious Sessions](#4-check-suspicious-sessions)
- **PATCH** `/current` - [Update Current Session](#5-update-current-session)
- **POST** `/current/extend` - [Extend Session](#6-extend-session)
- **DELETE** `/{sessionId}` - [Revoke Session](#7-revoke-session)
- **DELETE** `/` - [Revoke All Sessions](#8-revoke-all-sessions)

#### Social Authentication (`/api/v1/auth/social`)
- **POST** `/link` - [Link Social Account](#1-link-social-account)
- **DELETE** `/{provider}` - [Unlink Social Account](#2-unlink-social-account)
- **GET** `/linked` - [Get Linked Accounts](#3-get-linked-accounts)

#### Two-Factor Authentication (`/api/v1/auth/2fa`)
- **POST** `/enable` - [Enable 2FA](#1-enable-2fa)
- **POST** `/disable` - [Disable 2FA](#2-disable-2fa)
- **POST** `/verify` - [Verify 2FA Code](#3-verify-2fa-code)
- **GET** `/status` - [Get 2FA Status](#4-get-2fa-status)
- **POST** `/regenerate-backup-codes` - [Regenerate Backup Codes](#5-regenerate-backup-codes)
- **POST** `/recovery-codes` - [Get Recovery Codes](#6-get-recovery-codes)
- **POST** `/login` - [2FA Login](#7-2fa-login)

### User Management Service API (`/api/v1/users`)
- **GET** `/me` - [Get Current User Profile](#1-get-current-user-profile)
- **PUT** `/me` - [Update User Profile](#2-update-user-profile)
- **POST** `/me/profile-picture` - [Upload Profile Picture](#3-upload-profile-picture)
- **POST** `/me/verify-identity` - [Identity Verification](#4-identity-verification)
- **POST** `/me/addresses` - [Add Address](#5-add-address)
- **POST** `/reviews` - [Submit Review](#6-submit-review)
- **POST** `/me/blocked-users` - [Block User](#7-block-user)
- **POST** `/reports` - [Report User](#8-report-user)
- **GET** `/` - [Search Users](#9-search-users)
- **GET** `/{userId}/statistics` - [Get User Statistics](#10-get-user-statistics)
- **GET** `/me/activity` - [Get User Activity](#11-get-user-activity)
- **DELETE** `/me` - [Delete User Account](#12-delete-user-account)

#### Address Management (`/api/v1/users/addresses`)
- **GET** `/me/addresses` - [Get User Addresses](#1-get-user-addresses)
- **PUT** `/me/addresses/{addressId}` - [Update Address](#2-update-address)
- **DELETE** `/me/addresses/{addressId}` - [Delete Address](#3-delete-address)
- **POST** `/me/addresses/{addressId}/default` - [Set Default Address](#4-set-default-address)
- **POST** `/geocode` - [Geocode Address](#5-geocode-address)
- **GET** `/reverse-geocode` - [Reverse Geocode](#6-reverse-geocode)
- **POST** `/validate-address` - [Validate Address](#7-validate-address)
- **GET** `/nearby-addresses` - [Find Nearby Addresses (Admin)](#8-find-nearby-addresses-admin)

#### Review Management (`/api/v1/users/reviews`)
- **POST** `/reviews/{reviewId}/response` - [Add Review Response](#1-add-review-response)
- **POST** `/reviews/{reviewId}/report` - [Report Review](#2-report-review)
- **POST** `/reviews/{reviewId}/vote` - [Vote on Review](#3-vote-on-review)

#### Verification (`/api/v1/users/verification`)
- **GET** `/me/verification/status` - [Get Verification Status](#1-get-verification-status)
- **POST** `/me/verification/resubmit` - [Resubmit Verification](#2-resubmit-verification)
- **POST** `/me/verify-phone` - [Verify Phone Number](#3-verify-phone-number)
- **POST** `/me/verify-phone/confirm` - [Confirm Phone Verification](#4-confirm-phone-verification)
- **POST** `/verification/{verificationId}/approve` - [Approve Verification (Admin)](#5-approve-verification-admin)
- **POST** `/verification/{verificationId}/reject` - [Reject Verification (Admin)](#6-reject-verification-admin)
- **GET** `/verification/pending` - [Get Pending Verifications (Admin)](#7-get-pending-verifications-admin)
- **GET** `/verification/statistics` - [Get Verification Statistics (Admin)](#8-get-verification-statistics-admin)

#### Preferences (`/api/v1/users/preferences`)
- **PUT** `/me/notifications` - [Update Notification Preferences](#1-update-notification-preferences)
- **GET** `/me/preferences/{category}/{setting}` - [Get Preference Setting](#2-get-preference-setting)
- **PUT** `/me/preferences/{category}/{setting}` - [Update Preference Setting](#3-update-preference-setting)
- **POST** `/me/preferences/reset` - [Reset Preferences](#4-reset-preferences)

#### User Relations (`/api/v1/users/relations`)
- **POST** `/me/blocked-users` - [Block User](#1-block-user)
- **DELETE** `/me/blocked-users/{userId}` - [Unblock User](#2-unblock-user)
- **GET** `/me/blocked-users` - [Get Blocked Users](#3-get-blocked-users)
- **POST** `/me/favorites` - [Add User to Favorites](#4-add-user-to-favorites)
- **DELETE** `/me/favorites/{userId}` - [Remove User from Favorites](#5-remove-user-from-favorites)
- **GET** `/me/favorites` - [Get Favorite Users](#6-get-favorite-users)

### Trip Management Service API (`/api/v1/trips`)
- **POST** `/` - [Create Trip](#1-create-trip)
- **GET** `/search` - [Search Trips](#2-search-trips)
- **POST** `/{tripId}/start` - [Start Trip](#3-start-trip)
- **POST** `/{tripId}/complete` - [Complete Trip](#4-complete-trip)
- **GET** `/my-trips` - [Get My Trips](#5-get-my-trips)
- **POST** `/{tripId}/status` - [Update Trip Status](#6-update-trip-status)
- **POST** `/{tripId}/cancel` - [Cancel Trip](#7-cancel-trip)
- **POST** `/{tripId}/duplicate` - [Duplicate Trip](#8-duplicate-trip)
- **GET** `/{tripId}/capacity` - [Get Capacity Status](#9-get-capacity-status)
- **POST** `/{tripId}/capacity/check` - [Check Capacity](#10-check-capacity)
- **POST** `/{tripId}/capacity/reserve` - [Reserve Capacity](#11-reserve-capacity)
- **POST** `/{tripId}/capacity/release` - [Release Capacity](#12-release-capacity)
- **GET** `/{tripId}/weather` - [Get Trip Weather](#13-get-trip-weather)
- **POST** `/{tripId}/weather/refresh` - [Refresh Trip Weather](#14-refresh-trip-weather)
- **POST** `/{tripId}/share` - [Share Trip](#15-share-trip)
- **GET** `/{tripId}/export` - [Export Trip Data](#16-export-trip-data)

#### Trip Templates (`/api/v1/trips/templates`)
- **GET** `/` - [Get Templates](#1-get-templates)
- **POST** `/` - [Create Template](#2-create-template)
- **GET** `/public` - [Get Public Templates](#3-get-public-templates)
- **GET** `/popular` - [Get Popular Templates](#4-get-popular-templates)
- **GET** `/search` - [Search Templates](#5-search-templates)
- **GET** `/categories` - [Get Template Categories](#6-get-template-categories)
- **GET** `/{templateId}` - [Get Template by ID](#7-get-template-by-id)
- **PUT** `/{templateId}` - [Update Template](#8-update-template)
- **DELETE** `/{templateId}` - [Delete Template](#9-delete-template)
- **POST** `/{templateId}/create-trip` - [Create Trip from Template](#10-create-trip-from-template)

#### Trip Analytics (`/api/v1/trips/analytics`)
- **GET** `/` - [Get Trip Analytics](#1-get-trip-analytics)
- **GET** `/statistics` - [Get Trip Statistics](#2-get-trip-statistics)
- **GET** `/{tripId}/performance` - [Get Trip Performance](#3-get-trip-performance)
- **GET** `/popular-routes` - [Get Popular Routes](#4-get-popular-routes)
- **GET** `/recommendations` - [Get Trip Recommendations](#5-get-trip-recommendations)

#### Weather Integration (`/api/v1/trips/weather`)
- **GET** `/alerts` - [Get Weather Alerts](#1-get-weather-alerts)
- **POST** `/forecast` - [Get Route Forecast](#2-get-route-forecast)
- **GET** `/{tripId}/detailed` - [Get Detailed Weather](#3-get-detailed-weather)

### Delivery Request Service API (`/api/v1/deliveries`)
- **POST** `/requests` - [Create Delivery Request](#1-create-delivery-request)
- **POST** `/requests/{requestId}/offers` - [Create Delivery Offer](#2-create-delivery-offer)
- **POST** `/offers/{offerId}/accept` - [Accept Delivery Offer](#3-accept-delivery-offer)
- **GET** `/search` - [Search Delivery Requests](#4-search-delivery-requests)
- **GET** `/popular-routes` - [Get Popular Routes](#5-get-popular-routes)
- **GET** `/recommendations` - [Get Recommendations](#6-get-recommendations)
- **GET** `/statistics` - [Get Statistics](#7-get-statistics)
- **GET** `/my-requests` - [Get My Requests](#8-get-my-requests)
- **PUT** `/{requestId}` - [Update Delivery Request](#9-update-delivery-request)
- **POST** `/{requestId}/cancel` - [Cancel Delivery Request](#10-cancel-delivery-request)
- **POST** `/{requestId}/find-matches` - [Find Matches](#11-find-matches)
- **POST** `/{requestId}/duplicate` - [Duplicate Request](#12-duplicate-request)
- **GET** `/{requestId}/analytics` - [Get Request Analytics](#13-get-request-analytics)
- **POST** `/{requestId}/report` - [Report Request](#14-report-request)

#### Offer Management (`/api/v1/deliveries/offers`)
- **GET** `/my-offers` - [Get My Offers](#1-get-my-offers)
- **GET** `/statistics` - [Get Offer Statistics](#2-get-offer-statistics)
- **PUT** `/{offerId}` - [Update Offer](#3-update-offer)
- **POST** `/{offerId}/decline` - [Decline Offer](#4-decline-offer)
- **DELETE** `/{offerId}` - [Withdraw Offer](#5-withdraw-offer)
- **GET** `/requests/{requestId}/offers` - [Get Request Offers](#6-get-request-offers)

### QR Code Service API (`/api/v1/qr-codes`)
- **POST** `/pickup/generate` - [Generate Pickup QR Code](#1-generate-pickup-qr-code)
- **POST** `/delivery/generate` - [Generate Delivery QR Code](#2-generate-delivery-qr-code)
- **POST** `/pickup/validate` - [Validate Pickup QR Code](#3-validate-pickup-qr-code)
- **POST** `/delivery/validate` - [Validate Delivery QR Code](#4-validate-delivery-qr-code)
- **POST** `/bulk-generate` - [Bulk Generate QR Codes](#5-bulk-generate-qr-codes)
- **GET** `/{qrCodeId}` - [Get QR Code Details](#6-get-qr-code-details)
- **GET** `/delivery/{deliveryId}` - [Get Delivery QR Codes](#7-get-delivery-qr-codes)
- **GET** `/{qrCodeId}/image` - [Download QR Code Image](#8-download-qr-code-image)
- **POST** `/{qrCodeId}/regenerate` - [Regenerate QR Code](#9-regenerate-qr-code)
- **POST** `/{qrCodeId}/revoke` - [Revoke QR Code](#10-revoke-qr-code)
- **GET** `/history` - [Get QR Code History](#11-get-qr-code-history)
- **GET** `/analytics` - [Get QR Code Analytics](#12-get-qr-code-analytics)
- **GET** `/performance-metrics` - [Get Performance Metrics](#13-get-performance-metrics)
- **POST** `/test-scanner` - [Test QR Scanner](#14-test-qr-scanner)

#### QR Validation (`/api/v1/qr-codes/validation`)
- **POST** `/validate` - [Generic QR Validation](#1-generic-qr-validation)
- **POST** `/validate-backup` - [Validate Backup Code](#2-validate-backup-code)
- **POST** `/verify-integrity` - [Verify QR Code Integrity](#3-verify-qr-code-integrity)
- **GET** `/{qrCodeId}/scans` - [Get QR Code Scans](#4-get-qr-code-scans)
- **GET** `/validation-stats` - [Get Validation Statistics](#5-get-validation-statistics)
- **GET** `/suspicious-scans` - [Get Suspicious Scans](#6-get-suspicious-scans)
- **GET** `/validation-status` - [Get Validation Status](#7-get-validation-status)

#### Emergency Override (`/api/v1/qr-codes/emergency`)
- **POST** `/` - [Request Emergency Override](#1-request-emergency-override)
- **GET** `/history` - [Get Override History](#2-get-override-history)
- **GET** `/{overrideId}` - [Get Override Details](#3-get-override-details)
- **POST** `/{overrideId}/cancel` - [Cancel Override Request](#4-cancel-override-request)
- **POST** `/{overrideId}/use` - [Use Emergency Override](#5-use-emergency-override)
- **GET** `/pending` - [Get Pending Overrides (Admin)](#6-get-pending-overrides-admin)
- **POST** `/{overrideId}/approve` - [Approve Override (Admin)](#7-approve-override-admin)
- **POST** `/{overrideId}/reject` - [Reject Override (Admin)](#8-reject-override-admin)
- **GET** `/statistics` - [Get Override Statistics (Admin)](#9-get-override-statistics-admin)
- **GET** `/queue-metrics` - [Get Queue Metrics (Admin)](#10-get-queue-metrics-admin)
- **POST** `/bulk-approve` - [Bulk Approve Overrides (Admin)](#11-bulk-approve-overrides-admin)
- **GET** `/delivery/{deliveryId}/status` - [Get Delivery Override Status](#12-get-delivery-override-status)

### Payment Service API (`/api/v1/payments`)
- **POST** `/calculate-price` - [Calculate Delivery Price](#1-calculate-delivery-price)
- **POST** `/intents` - [Create Payment Intent](#2-create-payment-intent)
- **POST** `/intents/{paymentIntentId}/confirm` - [Confirm Payment](#3-confirm-payment)
- **POST** `/escrow/{escrowId}/release` - [Release Escrow Payment](#4-release-escrow-payment)
- **GET** `/intents/{paymentIntentId}` - [Get Payment Status](#5-get-payment-status)
- **POST** `/intents/{paymentIntentId}/cancel` - [Cancel Payment](#6-cancel-payment)
- **GET** `/history` - [Get Payment History](#7-get-payment-history)

#### Market Analysis (`/api/v1/payments/market`)
- **GET** `/market-analysis` - [Get Market Analysis](#1-get-market-analysis)
- **POST** `/optimize-pricing` - [Optimize Pricing](#2-optimize-pricing)
- **GET** `/exchange-rates` - [Get Exchange Rates](#3-get-exchange-rates)

#### Webhooks (`/api/v1/payments/webhooks`)
- **POST** `/stripe` - [Stripe Webhook Handler](#1-stripe-webhook-handler)

### Location Service API (`/api/v1/location`)
- **POST** `/track` - [Real-time Location Tracking](#1-real-time-location-tracking)
- **GET** `/current/{deliveryId}` - [Get Current Location](#2-get-current-location)
- **POST** `/route/optimize` - [Route Optimization](#3-route-optimization)
- **GET** `/geocode` - [Geocoding Service](#4-geocoding-service)
- **GET** `/history/{deliveryId}` - [Get Location History](#5-get-location-history)
- **GET** `/travelers/nearby` - [Find Nearby Travelers](#6-find-nearby-travelers)
- **GET** `/eta/{deliveryId}` - [Get ETA Updates](#7-get-eta-updates)
- **GET** `/analytics` - [Get Location Analytics](#8-get-location-analytics)

#### Batch Operations (`/api/v1/location/batch`)
- **POST** `/batch` - [Batch Geocoding](#1-batch-geocoding)
- **GET** `/suggestions` - [Get Address Suggestions](#2-get-address-suggestions)
- **GET** `/place/{placeId}` - [Get Place Details](#3-get-place-details)

#### Traffic (`/api/v1/location/traffic`)
- **GET** `/{routeId}/traffic` - [Get Route Traffic](#1-get-route-traffic)
- **GET** `/traffic` - [Get Traffic Information](#2-get-traffic-information)

#### Geofencing (`/api/v1/location/geofences`)
- **POST** `/` - [Create Geofence](#1-create-geofence)
- **GET** `/active` - [Get Active Geofences](#2-get-active-geofences)
- **PUT** `/{geofenceId}` - [Update Geofence](#3-update-geofence)
- **DELETE** `/{geofenceId}` - [Delete Geofence](#4-delete-geofence)
- **POST** `/check` - [Check Geofence Status](#5-check-geofence-status)
- **GET** `/{geofenceId}/events` - [Get Geofence Events](#6-get-geofence-events)
- **GET** `/{geofenceId}/stats` - [Get Geofence Statistics](#7-get-geofence-statistics)
- **POST** `/delivery` - [Create Delivery Geofences](#8-create-delivery-geofences)
- **GET** `/recommendations` - [Get Geofence Recommendations](#9-get-geofence-recommendations)

#### Emergency Services (`/api/v1/location/emergency`)
- **POST** `/` - [Report Emergency](#1-report-emergency)
- **PUT** `/{emergencyId}` - [Update Emergency Status](#2-update-emergency-status)
- **GET** `/services` - [Get Nearby Emergency Services](#3-get-nearby-emergency-services)
- **GET** `/{emergencyId}` - [Get Emergency Details](#4-get-emergency-details)
- **GET** `/history` - [Get Emergency History](#5-get-emergency-history)
- **GET** `/stats` - [Get Emergency Statistics](#6-get-emergency-statistics)
- **GET** `/active` - [Get Active Emergencies (Admin)](#7-get-active-emergencies-admin)

#### Privacy (`/api/v1/location/privacy`)
- **PUT** `/` - [Update Privacy Settings](#1-update-privacy-settings)
- **GET** `/` - [Get Privacy Settings](#2-get-privacy-settings)
- **POST** `/export` - [Export Location Data](#3-export-location-data)
- **GET** `/export/{exportId}` - [Get Export Status](#4-get-export-status)
- **DELETE** `/data` - [Delete Location Data](#5-delete-location-data)
- **POST** `/anonymize` - [Anonymize Data](#6-anonymize-data)
- **GET** `/audit` - [Get Privacy Audit Log](#7-get-privacy-audit-log)

### Notification Service API (`/api/v1/notifications`)
- **POST** `/push` - [Send Push Notification](#1-send-push-notification)
- **POST** `/email` - [Send Email Notification](#2-send-email-notification)
- **GET** `/user/{userId}` - [Get User Notifications](#3-get-user-notifications)
- **POST** `/send-custom` - [Send Custom Notification](#4-send-custom-notification)
- **POST** `/send-bulk` - [Send Bulk Notifications (Admin)](#5-send-bulk-notifications-admin)
- **POST** `/test` - [Test Notification (Admin)](#6-test-notification-admin)
- **POST** `/{notificationId}/read` - [Mark as Read](#7-mark-as-read)
- **POST** `/{notificationId}/clicked` - [Mark as Clicked](#8-mark-as-clicked)
- **PUT** `/user/{userId}/read-all` - [Mark All as Read](#9-mark-all-as-read)
- **DELETE** `/{notificationId}` - [Delete Notification](#10-delete-notification)
- **POST** `/device-tokens` - [Register Device Token](#11-register-device-token)
- **PUT** `/device-tokens/{tokenId}` - [Update Device Token](#12-update-device-token)
- **GET** `/stats/{userId}` - [Get Notification Statistics](#13-get-notification-statistics)
- **GET** `/health` - [Health Check](#14-health-check)

#### Notification Preferences (`/api/v1/notifications/preferences`)
- **GET** `/{userId}` - [Get User Preferences](#1-get-user-preferences)
- **PUT** `/{userId}` - [Update User Preferences](#2-update-user-preferences)
- **PUT** `/{userId}/channels/{channel}` - [Update Channel Preferences](#3-update-channel-preferences)
- **PUT** `/{userId}/quiet-hours` - [Update Quiet Hours](#4-update-quiet-hours)
- **GET** `/{userId}/settings` - [Get User Settings](#5-get-user-settings)
- **PUT** `/{userId}/settings/{settingKey}` - [Update User Setting](#6-update-user-setting)
- **PUT** `/{userId}/settings` - [Bulk Update Settings](#7-bulk-update-settings)
- **POST** `/{userId}/reset` - [Reset Preferences](#8-reset-preferences)
- **GET** `/{userId}/export` - [Export Preferences](#9-export-preferences)
- **POST** `/{userId}/import` - [Import Preferences](#10-import-preferences)
- **GET** `/stats/overview` - [Get Preference Statistics (Admin)](#11-get-preference-statistics-admin)

### Admin Service API (`/api/v1/admin`)
- **GET** `/dashboard` - [Admin Dashboard Overview](#1-admin-dashboard-overview)
- **GET** `/users` - [User Management](#2-user-management)
- **PUT** `/users/{userId}/status` - [Update User Status](#3-update-user-status)
- **GET** `/config` - [System Configuration](#4-system-configuration)
- **GET** `/users/{userId}` - [Get User Details](#5-get-user-details)

#### Analytics (`/api/v1/admin/analytics`)
- **GET** `/system` - [Get System Analytics](#1-get-system-analytics)
- **POST** `/export` - [Export Analytics Data](#2-export-analytics-data)

#### Dispute Management (`/api/v1/admin/disputes`)
- **GET** `/` - [Get Disputes](#1-get-disputes)
- **GET** `/{disputeId}` - [Get Dispute Details](#2-get-dispute-details)
- **PUT** `/{disputeId}/assign` - [Assign Dispute](#3-assign-dispute)
- **PUT** `/{disputeId}/resolve` - [Resolve Dispute](#4-resolve-dispute)

#### Financial Management (`/api/v1/admin/finance`)
- **GET** `/overview` - [Get Financial Overview](#1-get-financial-overview)
- **GET** `/transactions` - [Get Transactions](#2-get-transactions)
- **POST** `/payouts/manual` - [Manual Payout](#3-manual-payout)

#### System Management (`/api/v1/admin/system`)
- **PUT** `/config` - [Update System Configuration](#1-update-system-configuration)
- **POST** `/backups` - [Create System Backup](#2-create-system-backup)
- **GET** `/backups` - [Get System Backups](#3-get-system-backups)

---

## Authentication Service API

**Base URL:** `/api/v1/auth`  
**Port:** 3001

### 1. User Registration

**POST** `/register`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "confirmPassword": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1234567890",
  "dateOfBirth": "1990-01-01",
  "userType": "traveler|customer|both",
  "acceptedTerms": true,
  "acceptedPrivacy": true,
  "preferredLanguage": "en",
  "timezone": "UTC",
  "referralCode": "REF123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "userType": "traveler",
      "status": "pending_verification",
      "createdAt": "2025-01-01T00:00:00Z"
    },
    "verificationRequired": true
  },
  "message": "Registration successful. Please verify your email."
}
```

### 2. Email Verification

**POST** `/verify-email`

**Request Body:**
```json
{
  "email": "user@example.com",
  "verificationCode": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "verified": true,
    "accessToken": "jwt_token",
    "refreshToken": "refresh_token",
    "expiresIn": 3600,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "status": "active"
    }
  }
}
```

### 3. Login

**POST** `/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "deviceInfo": {
    "deviceId": "device_uuid",
    "deviceType": "mobile|web|tablet",
    "platform": "ios|android|web",
    "appVersion": "1.0.0",
    "pushToken": "fcm_token"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "jwt_token",
    "refreshToken": "refresh_token",
    "expiresIn": 3600,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "userType": "traveler",
      "status": "active",
      "profileComplete": true,
      "verificationLevel": "verified",
      "lastLoginAt": "2025-01-01T00:00:00Z"
    }
  }
}
```

### 4. Social Login

**POST** `/social-login`

**Request Body:**
```json
{
  "provider": "google|facebook|apple",
  "accessToken": "social_access_token",
  "userInfo": {
    "id": "social_user_id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "profilePicture": "https://example.com/pic.jpg"
  },
  "deviceInfo": {
    "deviceId": "device_uuid",
    "deviceType": "mobile|web|tablet",
    "platform": "ios|android|web",
    "appVersion": "1.0.0"
  }
}
```

### 5. Two-Factor Authentication Setup

**POST** `/2fa/setup`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "qrCode": "data:image/png;base64,iVBOR...",
    "secret": "SECRET_KEY",
    "backupCodes": ["123456", "789012", "345678"]
  }
}
```

### 6. Refresh Token

**POST** `/refresh`

**Request Body:**
```json
{
  "refreshToken": "refresh_token"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "new_jwt_token",
    "expiresIn": 3600
  }
}
```

### 7. Logout

**POST** `/logout`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "deviceId": "device_uuid",
  "logoutFromAllDevices": false
}
```

### 8. Forgot Password

**POST** `/forgot-password`

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

### 9. Reset Password

**POST** `/reset-password`

**Request Body:**
```json
{
  "email": "user@example.com",
  "resetCode": "123456",
  "newPassword": "NewSecurePass123!",
  "confirmPassword": "NewSecurePass123!"
}
```

### 10. Change Password

**POST** `/change-password`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "currentPassword": "CurrentPass123!",
  "newPassword": "NewSecurePass123!",
  "confirmPassword": "NewSecurePass123!"
}
```

### 11. Validate Token

**GET** `/validate`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 12. Resend Verification Code

**POST** `/resend-verification`

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

## Account Management API

**Base URL:** `/api/v1/auth/account`

### 1. Reactivate Account

**POST** `/reactivate`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### 2. Get Account Status

**GET** `/status`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 3. Update Account Settings

**PATCH** `/settings`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "preferredLanguage": "en|es|fr|de|it|pt",
  "timezone": "America/New_York",
  "preferredCurrency": "USD|EUR|GBP|CAD|AUD",
  "phoneNumber": "+1234567890"
}
```

### 4. Export Account Data

**GET** `/export`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 5. Get Security Log

**GET** `/security-log`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 6. Deactivate Account

**POST** `/deactivate`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 7. Delete Account

**DELETE** `/`

**Headers:**
```
Authorization: Bearer <access_token>
```

## Session Management API

**Base URL:** `/api/v1/auth/sessions`

### 1. Get User Sessions

**GET** `/`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 2. Get Current Session

**GET** `/current`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 3. Get Session Statistics

**GET** `/stats`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 4. Check Suspicious Sessions

**GET** `/suspicious`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 5. Update Current Session

**PATCH** `/current`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "pushToken": "fcm_token",
  "location": "New York, NY"
}
```

### 6. Extend Session

**POST** `/current/extend`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 7. Revoke Session

**DELETE** `/{sessionId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 8. Revoke All Sessions

**DELETE** `/`

**Headers:**
```
Authorization: Bearer <access_token>
```

## Social Authentication API

**Base URL:** `/api/v1/auth/social`

### 1. Link Social Account

**POST** `/link`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "provider": "google|facebook|apple",
  "accessToken": "social_access_token",
  "userInfo": {
    "id": "social_user_id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "profilePicture": "https://example.com/pic.jpg"
  }
}
```

### 2. Unlink Social Account

**DELETE** `/{provider}`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 3. Get Linked Accounts

**GET** `/linked`

**Headers:**
```
Authorization: Bearer <access_token>
```

## Two-Factor Authentication API

**Base URL:** `/api/v1/auth/2fa`

### 1. Enable 2FA

**POST** `/enable`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "code": "123456"
}
```

### 2. Disable 2FA

**POST** `/disable`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "code": "123456"
}
```

### 3. Verify 2FA Code

**POST** `/verify`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "code": "123456"
}
```

### 4. Get 2FA Status

**GET** `/status`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 5. Regenerate Backup Codes

**POST** `/regenerate-backup-codes`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "code": "123456"
}
```

### 6. Get Recovery Codes

**POST** `/recovery-codes`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "code": "123456"
}
```

### 7. 2FA Login

**POST** `/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "code": "123456",
  "backupCode": "backup123"
}
```

---

## User Management Service API

**Base URL:** `/api/v1/users`  
**Port:** 3002

### 1. Get Current User Profile

**GET** `/me`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phoneNumber": "+1234567890",
    "dateOfBirth": "1990-01-01",
    "profilePicture": "https://cdn.example.com/pic.jpg",
    "userType": "traveler",
    "status": "active",
    "verificationLevel": "verified",
    "rating": {
      "average": 4.8,
      "count": 156,
      "breakdown": {
        "5": 120,
        "4": 30,
        "3": 5,
        "2": 1,
        "1": 0
      }
    },
    "statistics": {
      "totalTrips": 45,
      "totalDeliveries": 123,
      "successfulDeliveries": 121,
      "totalEarnings": 2450.50,
      "joinedDate": "2024-01-01T00:00:00Z"
    },
    "preferences": {
      "language": "en",
      "currency": "USD",
      "timezone": "UTC",
      "notifications": {
        "email": true,
        "push": true,
        "sms": false
      },
      "privacy": {
        "showRealName": true,
        "showPhoneNumber": false,
        "showRating": true
      }
    },
    "documents": {
      "idVerified": true,
      "phoneVerified": true,
      "emailVerified": true,
      "backgroundCheckStatus": "approved"
    },
    "addresses": [
      {
        "id": "address_uuid",
        "type": "home|work|other",
        "label": "Home",
        "street": "123 Main St",
        "city": "New York",
        "state": "NY",
        "country": "US",
        "postalCode": "10001",
        "coordinates": {
          "lat": 40.7128,
          "lng": -74.0060
        },
        "isDefault": true
      }
    ],
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2025-01-01T00:00:00Z"
  }
}
```

### 2. Update User Profile

**PUT** `/me`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1234567890",
  "dateOfBirth": "1990-01-01",
  "bio": "Frequent traveler, happy to help with deliveries",
  "preferences": {
    "language": "en",
    "currency": "USD",
    "timezone": "UTC",
    "notifications": {
      "email": true,
      "push": true,
      "sms": false
    },
    "privacy": {
      "showRealName": true,
      "showPhoneNumber": false,
      "showRating": true
    }
  }
}
```

### 3. Upload Profile Picture

**POST** `/me/profile-picture`

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Request Body:**
```
profilePicture: <file> (max 5MB, jpg/png)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "profilePicture": "https://cdn.example.com/pic.jpg",
    "thumbnails": {
      "small": "https://cdn.example.com/pic_small.jpg",
      "medium": "https://cdn.example.com/pic_medium.jpg",
      "large": "https://cdn.example.com/pic_large.jpg"
    }
  }
}
```

### 4. Identity Verification

**POST** `/me/verify-identity`

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Request Body:**
```
documentType: "passport|driving_license|national_id"
frontImage: <file>
backImage: <file> (optional, for driving license)
selfieImage: <file>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "verificationId": "verification_uuid",
    "status": "pending",
    "estimatedProcessingTime": "24-48 hours"
  }
}
```

### 5. Add Address

**POST** `/me/addresses`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "type": "home|work|other",
  "label": "Home",
  "street": "123 Main St",
  "city": "New York",
  "state": "NY",
  "country": "US",
  "postalCode": "10001",
  "coordinates": {
    "lat": 40.7128,
    "lng": -74.0060
  },
  "isDefault": false
}
```

### 6. Submit Review

**POST** `/reviews`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "deliveryId": "delivery_uuid",
  "revieweeId": "user_uuid",
  "rating": 5,
  "comment": "Excellent service, very professional!",
  "categories": {
    "communication": 5,
    "punctuality": 5,
    "carefulness": 4,
    "friendliness": 5
  }
}
```

### 7. Block User

**POST** `/me/blocked-users`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "userId": "user_uuid",
  "reason": "inappropriate_behavior|spam|harassment|other",
  "comment": "Optional reason description"
}
```

### 8. Report User

**POST** `/reports`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "reportedUserId": "user_uuid",
  "deliveryId": "delivery_uuid",
  "category": "inappropriate_behavior|fraud|harassment|spam|other",
  "description": "Detailed description of the issue",
  "evidence": [
    {
      "type": "image|video|text",
      "url": "https://evidence.com/file.jpg",
      "description": "Screenshot of inappropriate message"
    }
  ]
}
```

### 9. Search Users

**GET** `/`

**Headers:**
```
Authorization: Bearer <access_token> (optional)
```

**Query Parameters:**
- `search`: Search term
- `userType`: Filter by user type
- `location`: Location filter
- `page`: Page number
- `limit`: Items per page

### 10. Get User Statistics

**GET** `/{userId}/statistics`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `period`: Time period (week|month|quarter|year)
- `startDate`: Start date
- `endDate`: End date

### 11. Get User Activity

**GET** `/me/activity`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `page`: Page number
- `limit`: Items per page

### 12. Delete User Account

**DELETE** `/me`

**Headers:**
```
Authorization: Bearer <access_token>
```

## Address Management API

**Base URL:** `/api/v1/users`

### 1. Get User Addresses

**GET** `/me/addresses`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 2. Update Address

**PUT** `/me/addresses/{addressId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "type": "home|work|other",
  "label": "Updated Label",
  "street": "456 Updated St",
  "city": "Updated City",
  "state": "UC",
  "country": "US",
  "postalCode": "54321"
}
```

### 3. Delete Address

**DELETE** `/me/addresses/{addressId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 4. Set Default Address

**POST** `/me/addresses/{addressId}/default`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 5. Geocode Address

**POST** `/geocode`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "street": "123 Main St",
  "city": "New York",
  "state": "NY",
  "country": "US",
  "postalCode": "10001"
}
```

### 6. Reverse Geocode

**GET** `/reverse-geocode`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `lat`: Latitude
- `lng`: Longitude

### 7. Validate Address

**POST** `/validate-address`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 8. Find Nearby Addresses (Admin)

**GET** `/nearby-addresses`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `lat`: Latitude
- `lng`: Longitude
- `radius`: Search radius

## Review Management API

**Base URL:** `/api/v1/users`

### 1. Add Review Response

**POST** `/reviews/{reviewId}/response`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "response": "Thank you for your feedback!"
}
```

### 2. Report Review

**POST** `/reviews/{reviewId}/report`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "reason": "inappropriate|spam|fake|other",
  "description": "Detailed reason for reporting"
}
```

### 3. Vote on Review

**POST** `/reviews/{reviewId}/vote`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "vote": "helpful|not_helpful"
}
```

## Verification Management API

**Base URL:** `/api/v1/users`

### 1. Get Verification Status

**GET** `/me/verification/status`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 2. Resubmit Verification

**POST** `/me/verification/resubmit`

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Request Body:**
```
documentType: "passport|driving_license|national_id"
frontImage: <file>
backImage: <file>
selfieImage: <file>
```

### 3. Verify Phone Number

**POST** `/me/verify-phone`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "phoneNumber": "+1234567890"
}
```

### 4. Confirm Phone Verification

**POST** `/me/verify-phone/confirm`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "verificationCode": "123456"
}
```

### 5. Approve Verification (Admin)

**POST** `/verification/{verificationId}/approve`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 6. Reject Verification (Admin)

**POST** `/verification/{verificationId}/reject`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "reason": "document_unclear|invalid_document|other",
  "notes": "Please provide a clearer image"
}
```

### 7. Get Pending Verifications (Admin)

**GET** `/verification/pending`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 8. Get Verification Statistics (Admin)

**GET** `/verification/statistics`

**Headers:**
```
Authorization: Bearer <access_token>
```

## User Preferences API

**Base URL:** `/api/v1/users`

### 1. Update Notification Preferences

**PUT** `/me/notifications`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "email": true,
  "push": true,
  "sms": false
}
```

### 2. Get Preference Setting

**GET** `/me/preferences/{category}/{setting}`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 3. Update Preference Setting

**PUT** `/me/preferences/{category}/{setting}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "value": "setting_value"
}
```

### 4. Reset Preferences

**POST** `/me/preferences/reset`

**Headers:**
```
Authorization: Bearer <access_token>
```

## User Relationships API

**Base URL:** `/api/v1/users`

### 1. Block User

**POST** `/me/blocked-users`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "userId": "user_uuid",
  "reason": "inappropriate_behavior|spam|harassment|other",
  "comment": "Optional reason description"
}
```

### 2. Unblock User

**DELETE** `/me/blocked-users/{userId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 3. Get Blocked Users

**GET** `/me/blocked-users`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 4. Add User to Favorites

**POST** `/me/favorites`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "userId": "user_uuid",
  "notes": "Excellent service",
  "priority": "high|medium|low",
  "notificationSettings": {
    "notifyOnNewTrip": true,
    "notifyOnPriceChange": true,
    "maxNotificationDistance": 50
  }
}
```

### 5. Remove User from Favorites

**DELETE** `/me/favorites/{userId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 6. Get Favorite Users

**GET** `/me/favorites`

**Headers:**
```
Authorization: Bearer <access_token>
```

---

## Trip Management Service API

**Base URL:** `/api/v1/trips`  
**Port:** 3003

### 1. Create Trip

**POST** `/`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "title": "NYC to Boston Business Trip",
  "description": "Regular business trip, happy to help with deliveries",
  "type": "flight|train|bus|car|other",
  "origin": {
    "address": "New York, NY, USA",
    "coordinates": {
      "lat": 40.7128,
      "lng": -74.0060
    },
    "airport": "JFK",
    "terminal": "Terminal 4",
    "details": "Gate information will be updated"
  },
  "destination": {
    "address": "Boston, MA, USA",
    "coordinates": {
      "lat": 42.3601,
      "lng": -71.0589
    },
    "airport": "BOS",
    "terminal": "Terminal B"
  },
  "departureTime": "2025-02-01T10:00:00Z",
  "arrivalTime": "2025-02-01T11:30:00Z",
  "estimatedDuration": 90,
  "capacity": {
    "weight": 5,
    "volume": 10,
    "items": 3
  },
  "pricing": {
    "basePrice": 15.00,
    "pricePerKg": 5.00,
    "pricePerKm": 0.50,
    "expressDeliveryMultiplier": 1.5,
    "fragileItemMultiplier": 1.3
  },
  "restrictions": {
    "noFragile": false,
    "noLiquids": true,
    "noElectronics": false,
    "maxItemValue": 500.00,
    "prohibitedItems": ["weapons", "drugs", "alcohol"]
  },
  "preferences": {
    "meetingPreference": "airport|home|public_place|flexible",
    "communicationPreference": "app_only|phone|email",
    "advanceNotice": 24
  },
  "isRecurring": false,
  "recurringPattern": {
    "frequency": "weekly|monthly|custom",
    "daysOfWeek": [1, 3, 5],
    "endDate": "2025-06-01T00:00:00Z"
  },
  "visibility": "public|private|friends_only",
  "autoAccept": false,
  "tags": ["business", "frequent", "reliable"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "trip_uuid",
    "title": "NYC to Boston Business Trip",
    "status": "upcoming",
    "traveler": {
      "id": "user_uuid",
      "firstName": "John",
      "lastName": "Doe",
      "profilePicture": "https://cdn.example.com/pic.jpg",
      "rating": {
        "average": 4.8,
        "count": 156
      }
    },
    "origin": {
      "address": "New York, NY, USA",
      "coordinates": {
        "lat": 40.7128,
        "lng": -74.0060
      }
    },
    "destination": {
      "address": "Boston, MA, USA",
      "coordinates": {
        "lat": 42.3601,
        "lng": -71.0589
      }
    },
    "departureTime": "2025-02-01T10:00:00Z",
    "arrivalTime": "2025-02-01T11:30:00Z",
    "availableCapacity": {
      "weight": 5,
      "volume": 10,
      "items": 3
    },
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

### 2. Search Trips

**GET** `/search`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `origin`: Origin city/address
- `destination`: Destination city/address
- `originLat`: Origin latitude
- `originLng`: Origin longitude
- `destinationLat`: Destination latitude
- `destinationLng`: Destination longitude
- `radius`: Search radius in km (default: 50)
- `departureDate`: Departure date (YYYY-MM-DD)
- `departureDateFrom`: Departure date range start
- `departureDateTo`: Departure date range end
- `type`: Trip type (flight|train|bus|car)
- `minCapacityWeight`: Minimum weight capacity
- `minCapacityVolume`: Minimum volume capacity
- `maxPrice`: Maximum price
- `minRating`: Minimum traveler rating
- `sortBy`: Sort by (price|departure|rating|distance)
- `sortOrder`: Sort order (asc|desc)
- `page`: Page number
- `limit`: Items per page

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "trip_uuid",
      "title": "NYC to Boston Business Trip",
      "traveler": {
        "id": "user_uuid",
        "firstName": "John",
        "lastName": "Doe",
        "profilePicture": "https://cdn.example.com/pic.jpg",
        "rating": {
          "average": 4.8,
          "count": 156
        }
      },
      "route": {
        "origin": {
          "address": "New York, NY",
          "coordinates": {
            "lat": 40.7128,
            "lng": -74.0060
          }
        },
        "destination": {
          "address": "Boston, MA",
          "coordinates": {
            "lat": 42.3601,
            "lng": -71.0589
          }
        },
        "distance": 306
      },
      "schedule": {
        "departureTime": "2025-02-01T10:00:00Z",
        "arrivalTime": "2025-02-01T11:30:00Z"
      },
      "availableCapacity": {
        "weight": 3,
        "volume": 7,
        "items": 2
      },
      "estimatedPrice": 25.50,
      "type": "flight"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### 3. Start Trip

**POST** `/{tripId}/start`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "currentLocation": {
    "lat": 40.7128,
    "lng": -74.0060
  },
  "actualDepartureTime": "2025-02-01T10:15:00Z",
  "notes": "Delayed departure due to traffic"
}
```

### 4. Complete Trip

**POST** `/{tripId}/complete`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "actualArrivalTime": "2025-02-01T11:45:00Z",
  "finalLocation": {
    "lat": 42.3601,
    "lng": -71.0589
  },
  "notes": "Trip completed successfully"
}
```

### 5. Get My Trips

**GET** `/my-trips`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `status`: Filter by status
- `page`: Page number
- `limit`: Items per page

### 6. Update Trip Status

**POST** `/{tripId}/status`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "status": "active|completed|cancelled",
  "reason": "Status change reason"
}
```

### 7. Cancel Trip

**POST** `/{tripId}/cancel`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "reason": "personal|weather|emergency|other",
  "description": "Detailed cancellation reason"
}
```

### 8. Duplicate Trip

**POST** `/{tripId}/duplicate`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "departureTime": "2025-02-15T10:00:00Z",
  "arrivalTime": "2025-02-15T11:30:00Z",
  "modifications": {
    "title": "Updated trip title",
    "capacity": {
      "weight": 6,
      "volume": 12,
      "items": 4
    },
    "pricing": {
      "basePrice": 20.00
    }
  }
}
```

### 9. Get Capacity Status

**GET** `/{tripId}/capacity`

**Headers:**
```
Authorization: Bearer <access_token> (optional)
```

### 10. Check Capacity

**POST** `/{tripId}/capacity/check`

**Request Body:**
```json
{
  "capacity": {
    "weight": 2.5,
    "volume": 5,
    "items": 1
  }
}
```

### 11. Reserve Capacity

**POST** `/{tripId}/capacity/reserve`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "capacity": {
    "weight": 2.5,
    "volume": 5,
    "items": 1
  },
  "reservationId": "reservation_uuid",
  "holdTime": 15
}
```

### 12. Release Capacity

**POST** `/{tripId}/capacity/release`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "reservationId": "reservation_uuid"
}
```

### 13. Get Trip Weather

**GET** `/{tripId}/weather`

**Headers:**
```
Authorization: Bearer <access_token> (optional)
```

### 14. Refresh Trip Weather

**POST** `/{tripId}/weather/refresh`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 15. Share Trip

**POST** `/{tripId}/share`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "method": "link|qr|social",
  "platform": "whatsapp|telegram|facebook|twitter",
  "message": "Check out my trip!"
}
```

### 16. Export Trip Data

**GET** `/{tripId}/export`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `format`: Export format (json|csv|pdf)
- `includePersonalData`: Include personal data (true|false)

## Trip Templates API

**Base URL:** `/api/v1/trips/templates`

### 1. Get Templates

**GET** `/`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `page`: Page number
- `limit`: Items per page

### 2. Create Template

**POST** `/`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "name": "Business Trip Template",
  "description": "Regular business trip template",
  "tripData": {
    "type": "flight",
    "capacity": {
      "weight": 5,
      "volume": 10,
      "items": 3
    }
  },
  "category": "business",
  "tags": ["frequent", "reliable"],
  "isPublic": false
}
```

### 3. Get Public Templates

**GET** `/public`

**Headers:**
```
Authorization: Bearer <access_token> (optional)
```

### 4. Get Popular Templates

**GET** `/popular`

**Headers:**
```
Authorization: Bearer <access_token> (optional)
```

**Query Parameters:**
- `limit`: Number of results (default: 10)

### 5. Search Templates

**GET** `/search`

**Headers:**
```
Authorization: Bearer <access_token> (optional)
```

**Query Parameters:**
- `origin`: Origin location
- `destination`: Destination location
- `category`: Template category
- `page`: Page number
- `limit`: Items per page

### 6. Get Template Categories

**GET** `/categories`

**Headers:**
```
Authorization: Bearer <access_token> (optional)
```

### 7. Get Template by ID

**GET** `/{templateId}`

**Headers:**
```
Authorization: Bearer <access_token> (optional)
```

### 8. Update Template

**PUT** `/{templateId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "name": "Updated Template Name",
  "description": "Updated description",
  "tripData": {},
  "category": "business",
  "tags": ["updated"],
  "isPublic": true
}
```

### 9. Delete Template

**DELETE** `/{templateId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 10. Create Trip from Template

**POST** `/{templateId}/create-trip`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "departureTime": "2025-02-01T10:00:00Z",
  "arrivalTime": "2025-02-01T11:30:00Z",
  "overrides": {
    "title": "Custom trip title",
    "capacity": {
      "weight": 6
    },
    "pricing": {
      "basePrice": 25.00
    }
  }
}
```

## Trip Analytics API

**Base URL:** `/api/v1/trips/analytics`

### 1. Get Trip Analytics

**GET** `/`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `period`: Time period
- `startDate`: Start date
- `endDate`: End date

### 2. Get Trip Statistics

**GET** `/statistics`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `period`: Time period (week|month|quarter|year)
- `groupBy`: Group by (day|week|month)
- `startDate`: Start date
- `endDate`: End date

### 3. Get Trip Performance

**GET** `/{tripId}/performance`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 4. Get Popular Routes

**GET** `/popular-routes`

**Headers:**
```
Authorization: Bearer <access_token> (optional)
```

**Query Parameters:**
- `period`: Time period
- `limit`: Number of results
- `origin`: Origin filter
- `destination`: Destination filter

### 5. Get Trip Recommendations

**GET** `/recommendations`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `origin`: Origin location
- `destination`: Destination location
- `type`: Trip type
- `preferences`: User preferences

## Weather API

**Base URL:** `/api/v1/trips/weather`

### 1. Get Weather Alerts

**GET** `/alerts`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `severity`: Alert severity (low|medium|high|critical)
- `limit`: Number of results

### 2. Get Route Forecast

**POST** `/forecast`

**Headers:**
```
Authorization: Bearer <access_token> (optional)
```

**Request Body:**
```json
{
  "origin": {
    "lat": 40.7128,
    "lng": -74.0060
  },
  "destination": {
    "lat": 42.3601,
    "lng": -71.0589
  },
  "departureTime": "2025-02-01T10:00:00Z"
}
```

### 3. Get Detailed Weather

**GET** `/{tripId}/detailed`

**Headers:**
```
Authorization: Bearer <access_token> (optional)
```

---

## Delivery Request Service API

**Base URL:** `/api/v1/deliveries`  
**Port:** 3004

### 1. Create Delivery Request

**POST** `/requests`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "title": "Important Documents Delivery",
  "description": "Legal documents that need urgent delivery",
  "category": "documents|electronics|clothing|food|fragile|other",
  "item": {
    "name": "Legal Documents",
    "description": "Sealed envelope with contracts",
    "quantity": 1,
    "weight": 0.5,
    "dimensions": {
      "length": 30,
      "width": 20,
      "height": 2
    },
    "value": 500.00,
    "fragile": false,
    "perishable": false,
    "hazardous": false,
    "requiresSignature": true,
    "images": [
      "https://images.example.com/item1.jpg",
      "https://images.example.com/item2.jpg"
    ]
  },
  "pickup": {
    "address": "123 Main St, New York, NY 10001",
    "coordinates": {
      "lat": 40.7128,
      "lng": -74.0060
    },
    "contactPerson": "John Smith",
    "phoneNumber": "+1234567890",
    "instructions": "Ring doorbell, apartment 3B",
    "timeWindow": {
      "start": "2025-02-01T09:00:00Z",
      "end": "2025-02-01T18:00:00Z"
    },
    "flexibleTiming": true,
    "preferredDays": ["monday", "tuesday", "wednesday"]
  },
  "delivery": {
    "address": "456 Oak St, Boston, MA 02101",
    "coordinates": {
      "lat": 42.3601,
      "lng": -71.0589
    },
    "contactPerson": "Jane Doe",
    "phoneNumber": "+0987654321",
    "instructions": "Leave with building concierge",
    "timeWindow": {
      "start": "2025-02-01T10:00:00Z",
      "end": "2025-02-01T20:00:00Z"
    },
    "requiresRecipientPresence": true
  },
  "urgency": "standard|express|urgent",
  "maxPrice": 50.00,
  "autoAcceptPrice": 30.00,
  "preferredTravelers": ["traveler_uuid1", "traveler_uuid2"],
  "blacklistedTravelers": ["traveler_uuid3"],
  "requirements": {
    "minTravelerRating": 4.5,
    "verificationRequired": true,
    "insuranceRequired": false,
    "backgroundCheckRequired": false
  },
  "notifications": {
    "sms": true,
    "email": true,
    "push": true
  },
  "specialInstructions": "Handle with care, very important documents",
  "tags": ["urgent", "documents", "business"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "request_uuid",
    "title": "Important Documents Delivery",
    "status": "pending",
    "customer": {
      "id": "customer_uuid",
      "firstName": "John",
      "lastName": "Smith"
    },
    "item": {
      "name": "Legal Documents",
      "weight": 0.5,
      "value": 500.00
    },
    "route": {
      "origin": "New York, NY",
      "destination": "Boston, MA",
      "distance": 306
    },
    "estimatedPrice": {
      "min": 25.00,
      "max": 45.00,
      "recommended": 35.00
    },
    "urgency": "standard",
    "createdAt": "2025-01-01T00:00:00Z",
    "expiresAt": "2025-01-08T00:00:00Z"
  }
}
```

### 2. Create Delivery Offer

**POST** `/requests/{requestId}/offers`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "price": 28.00,
  "message": "I can deliver this safely and on time. I have experience with important documents.",
  "tripId": "trip_uuid",
  "estimatedPickupTime": "2025-02-01T11:00:00Z",
  "estimatedDeliveryTime": "2025-02-01T13:30:00Z",
  "guarantees": {
    "insurance": 1000.00,
    "onTimeDelivery": true,
    "safeHandling": true
  },
  "specialServices": {
    "photoUpdates": true,
    "signatureRequired": true,
    "realTimeTracking": true
  },
  "validUntil": "2025-01-03T00:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "offer_uuid",
    "requestId": "request_uuid",
    "traveler": {
      "id": "traveler_uuid",
      "firstName": "Jane",
      "lastName": "Doe"
    },
    "price": 28.00,
    "status": "pending",
    "estimatedPickupTime": "2025-02-01T11:00:00Z",
    "estimatedDeliveryTime": "2025-02-01T13:30:00Z",
    "createdAt": "2025-01-01T01:00:00Z"
  }
}
```

### 3. Accept Delivery Offer

**POST** `/offers/{offerId}/accept`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "message": "Great! Looking forward to working with you.",
  "paymentMethod": "card|wallet|bank_transfer",
  "specialRequests": "Please send photo updates during transit"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "deliveryId": "delivery_uuid",
    "status": "accepted",
    "traveler": {
      "id": "traveler_uuid",
      "firstName": "Jane",
      "lastName": "Doe",
      "phoneNumber": "+1234567890"
    },
    "finalPrice": 28.00,
    "estimatedPickupTime": "2025-02-01T11:00:00Z",
    "estimatedDeliveryTime": "2025-02-01T13:30:00Z",
    "qrCodes": {
      "pickup": "pickup_qr_code_data",
      "delivery": "delivery_qr_code_data"
    },
    "contractId": "contract_uuid"
  }
}
```

### 4. Search Delivery Requests

**GET** `/search`

**Headers:**
```
Authorization: Bearer <access_token> (optional)
```

**Query Parameters:**
- `origin`: Origin location
- `destination`: Destination location
- `category`: Item category
- `maxPrice`: Maximum price
- `urgency`: Urgency level
- `page`: Page number
- `limit`: Items per page

### 5. Get Popular Routes

**GET** `/popular-routes`

**Headers:**
```
Authorization: Bearer <access_token> (optional)
```

**Query Parameters:**
- `page`: Page number
- `limit`: Items per page

### 6. Get Recommendations

**GET** `/recommendations`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 7. Get Statistics

**GET** `/statistics`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 8. Get My Requests

**GET** `/my-requests`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `status`: Filter by status
- `page`: Page number
- `limit`: Items per page

### 9. Update Delivery Request

**PUT** `/{requestId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "title": "Updated title",
  "description": "Updated description",
  "maxPrice": 60.00,
  "urgency": "express"
}
```

### 10. Cancel Delivery Request

**POST** `/{requestId}/cancel`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "reason": "no_longer_needed|found_alternative|price_too_high|other",
  "description": "Detailed cancellation reason"
}
```

### 11. Find Matches

**POST** `/{requestId}/find-matches`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 12. Duplicate Request

**POST** `/{requestId}/duplicate`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 13. Get Request Analytics

**GET** `/{requestId}/analytics`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 14. Report Request

**POST** `/{requestId}/report`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "reason": "inappropriate|spam|fraudulent|other",
  "description": "Detailed report reason"
}
```

## Offer Management API

**Base URL:** `/api/v1/deliveries/offers`

### 1. Get My Offers

**GET** `/my-offers`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `status`: Filter by status
- `page`: Page number
- `limit`: Items per page

### 2. Get Offer Statistics

**GET** `/statistics`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 3. Update Offer

**PUT** `/{offerId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "price": 35.00,
  "message": "Updated offer message",
  "estimatedPickupTime": "2025-02-01T12:00:00Z",
  "estimatedDeliveryTime": "2025-02-01T14:00:00Z"
}
```

### 4. Decline Offer

**POST** `/{offerId}/decline`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "reason": "price_too_low|timing_conflict|other",
  "description": "Detailed decline reason"
}
```

### 5. Withdraw Offer

**DELETE** `/{offerId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "reason": "changed_mind|schedule_conflict|other",
  "description": "Detailed withdrawal reason"
}
```

### 6. Get Request Offers

**GET** `/requests/{requestId}/offers`

**Headers:**
```
Authorization: Bearer <access_token>
```

---

## QR Code Service API

**Base URL:** `/api/v1/qr`  
**Port:** 3006

### 1. Generate Pickup QR Code

**POST** `/pickup/generate`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "deliveryId": "delivery_uuid",
  "expirationTime": "2025-02-01T12:00:00Z",
  "securityLevel": "standard|high|maximum",
  "additionalData": {
    "itemDescription": "Legal Documents",
    "expectedWeight": 0.5,
    "specialInstructions": "Handle with care"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "qrCodeId": "qr_pickup_uuid",
    "qrCodeData": "QR_ENCRYPTED_DATA_STRING",
    "qrCodeImage": "data:image/png;base64,iVBOR...",
    "downloadUrl": "https://qr.p2pdelivery.com/pickup_uuid.png",
    "expiresAt": "2025-02-01T12:00:00Z",
    "scanInstructions": "Show this QR code to the traveler for item pickup verification",
    "backupCode": "PICKUP-123-456-789",
    "securityFeatures": {
      "encrypted": true,
      "timestamped": true,
      "locationBound": false,
      "singleUse": true
    }
  }
}
```

### 2. Generate Delivery QR Code

**POST** `/delivery/generate`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "deliveryId": "delivery_uuid",
  "pickupQrId": "qr_pickup_uuid",
  "expirationTime": "2025-02-01T15:00:00Z",
  "securityLevel": "standard|high|maximum",
  "requiresSignature": true,
  "requiresPhoto": true,
  "locationVerification": {
    "required": true,
    "radius": 100
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "qrCodeId": "qr_delivery_uuid",
    "qrCodeData": "QR_ENCRYPTED_DATA_STRING",
    "qrCodeImage": "data:image/png;base64,iVBOR...",
    "downloadUrl": "https://qr.p2pdelivery.com/delivery_uuid.png",
    "expiresAt": "2025-02-01T15:00:00Z",
    "scanInstructions": "Show this QR code to the recipient for delivery confirmation",
    "backupCode": "DELIVERY-987-654-321",
    "securityFeatures": {
      "encrypted": true,
      "timestamped": true,
      "locationBound": true,
      "requiresSignature": true,
      "requiresPhoto": true,
      "singleUse": true
    }
  }
}
```

### 3. Validate Pickup QR Code

**POST** `/pickup/validate`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "qrCodeData": "QR_ENCRYPTED_DATA_STRING",
  "qrCodeId": "qr_pickup_uuid",
  "backupCode": "PICKUP-123-456-789",
  "scannerLocation": {
    "lat": 40.7128,
    "lng": -74.0060,
    "accuracy": 10
  },
  "deviceInfo": {
    "deviceId": "device_uuid",
    "platform": "ios|android|web",
    "appVersion": "1.0.0"
  },
  "additionalVerification": {
    "photoTaken": true,
    "photoUrl": "https://photos.example.com/pickup.jpg",
    "notes": "Item received in good condition"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "deliveryId": "delivery_uuid",
    "verification": {
      "verificationId": "verification_uuid",
      "timestamp": "2025-02-01T11:30:00Z",
      "location": {
        "lat": 40.7128,
        "lng": -74.0060
      },
      "verifiedBy": {
        "id": "traveler_uuid",
        "firstName": "Jane",
        "lastName": "Doe"
      }
    },
    "delivery": {
      "id": "delivery_uuid",
      "status": "picked_up",
      "item": {
        "name": "Legal Documents",
        "expectedWeight": 0.5
      },
      "customer": {
        "firstName": "John",
        "lastName": "Smith"
      }
    },
    "nextSteps": {
      "deliveryQrRequired": true,
      "estimatedDeliveryTime": "2025-02-01T13:30:00Z",
      "deliveryInstructions": "Contact recipient 30 minutes before arrival"
    },
    "blockchain": {
      "transactionHash": "0x1234...abcd",
      "blockNumber": 12345678
    }
  }
}
```

### 4. Validate Delivery QR Code

**POST** `/delivery/validate`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "qrCodeData": "QR_ENCRYPTED_DATA_STRING",
  "qrCodeId": "qr_delivery_uuid",
  "backupCode": "DELIVERY-987-654-321",
  "scannerLocation": {
    "lat": 42.3601,
    "lng": -71.0589,
    "accuracy": 5
  },
  "recipientVerification": {
    "recipientPresent": true,
    "recipientId": "recipient_uuid",
    "recipientName": "Jane Doe",
    "recipientSignature": "data:image/png;base64,signature...",
    "idVerification": {
      "method": "photo_id|biometric|none",
      "photoUrl": "https://photos.example.com/id.jpg"
    }
  },
  "deliveryEvidence": {
    "photoUrl": "https://photos.example.com/delivery.jpg",
    "videoUrl": "https://videos.example.com/delivery.mp4",
    "notes": "Delivered to recipient in person",
    "condition": "excellent|good|fair|damaged"
  },
  "deviceInfo": {
    "deviceId": "device_uuid",
    "platform": "ios|android|web",
    "appVersion": "1.0.0"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "deliveryId": "delivery_uuid",
    "verification": {
      "verificationId": "verification_uuid",
      "timestamp": "2025-02-01T13:45:00Z",
      "location": {
        "lat": 42.3601,
        "lng": -71.0589
      },
      "deliveredBy": {
        "id": "traveler_uuid",
        "firstName": "Jane",
        "lastName": "Doe"
      },
      "receivedBy": {
        "name": "Jane Doe",
        "signature": "data:image/png;base64,signature..."
      }
    },
    "delivery": {
      "id": "delivery_uuid",
      "status": "completed",
      "completedAt": "2025-02-01T13:45:00Z",
      "timeline": {
        "requested": "2025-01-01T00:00:00Z",
        "accepted": "2025-01-01T01:00:00Z",
        "pickedUp": "2025-02-01T11:30:00Z",
        "completed": "2025-02-01T13:45:00Z"
      }
    },
    "payment": {
      "status": "processing",
      "amount": 28.00,
      "currency": "USD",
      "releaseTime": "2025-02-01T14:45:00Z"
    },
    "blockchain": {
      "transactionHash": "0x5678...efgh",
      "blockNumber": 12345679
    }
  }
}
```

### 5. Bulk Generate QR Codes

**POST** `/bulk-generate`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "requests": [
    {
      "deliveryId": "delivery_uuid_1",
      "type": "pickup|delivery",
      "expirationTime": "2025-02-01T12:00:00Z"
    },
    {
      "deliveryId": "delivery_uuid_2",
      "type": "pickup|delivery",
      "expirationTime": "2025-02-01T15:00:00Z"
    }
  ]
}
```

### 6. Get QR Code Details

**GET** `/{qrCodeId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 7. Get Delivery QR Codes

**GET** `/delivery/{deliveryId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 8. Download QR Code Image

**GET** `/{qrCodeId}/image`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 9. Regenerate QR Code

**POST** `/{qrCodeId}/regenerate`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 10. Revoke QR Code

**POST** `/{qrCodeId}/revoke`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 11. Get QR Code History

**GET** `/history`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `deliveryId`: Filter by delivery ID
- `type`: Filter by type (pickup|delivery)
- `status`: Filter by status
- `page`: Page number
- `limit`: Items per page

### 12. Get QR Code Analytics

**GET** `/analytics`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 13. Get Performance Metrics

**GET** `/performance-metrics`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 14. Test QR Scanner

**POST** `/test-scanner`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "qrCodeData": "test_qr_data",
  "deviceInfo": {
    "platform": "ios|android|web",
    "appVersion": "1.0.0"
  }
}
```

## QR Code Validation API

**Base URL:** `/api/v1/qr/validation`

### 1. Generic QR Validation

**POST** `/validate`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "qrCodeData": "QR_ENCRYPTED_DATA_STRING",
  "scannerLocation": {
    "lat": 40.7128,
    "lng": -74.0060,
    "accuracy": 10
  },
  "deviceInfo": {
    "deviceId": "device_uuid",
    "platform": "ios|android|web"
  }
}
```

### 2. Validate Backup Code

**POST** `/validate-backup`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "backupCode": "BACKUP-123-456-789",
  "deliveryId": "delivery_uuid",
  "type": "pickup|delivery"
}
```

### 3. Verify QR Code Integrity

**POST** `/verify-integrity`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "qrCodeData": "QR_ENCRYPTED_DATA_STRING"
}
```

### 4. Get QR Code Scans

**GET** `/{qrCodeId}/scans`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 5. Get Validation Statistics

**GET** `/validation-stats`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 6. Get Suspicious Scans

**GET** `/suspicious-scans`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 7. Get Validation Status

**GET** `/validation-status`

**Headers:**
```
Authorization: Bearer <access_token>
```

## Emergency Override API

**Base URL:** `/api/v1/qr/emergency`

### 1. Request Emergency Override

**POST** `/`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "deliveryId": "delivery_uuid",
  "reason": "qr_code_damaged|device_malfunction|emergency_situation|other",
  "description": "Detailed description of emergency",
  "evidence": [
    {
      "type": "photo|video|document",
      "url": "https://evidence.com/file.jpg"
    }
  ]
}
```

### 2. Get Override History

**GET** `/history`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 3. Get Override Details

**GET** `/{overrideId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 4. Cancel Override Request

**POST** `/{overrideId}/cancel`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 5. Use Emergency Override

**POST** `/{overrideId}/use`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "deliveryId": "delivery_uuid",
  "location": {
    "lat": 40.7128,
    "lng": -74.0060
  },
  "evidence": {
    "photoUrl": "https://photos.example.com/override.jpg",
    "notes": "Emergency override used due to QR code damage"
  }
}
```

### 6. Get Pending Overrides (Admin)

**GET** `/pending`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 7. Approve Override (Admin)

**POST** `/{overrideId}/approve`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "approvalNotes": "Valid emergency situation",
  "conditions": [
    "must_provide_photo_evidence",
    "limited_to_current_delivery"
  ]
}
```

### 8. Reject Override (Admin)

**POST** `/{overrideId}/reject`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "rejectionReason": "insufficient_evidence|not_emergency|other",
  "notes": "Please provide additional evidence"
}
```

### 9. Get Override Statistics (Admin)

**GET** `/statistics`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 10. Get Queue Metrics (Admin)

**GET** `/queue-metrics`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 11. Bulk Approve Overrides (Admin)

**POST** `/bulk-approve`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "overrideIds": ["override_1", "override_2"],
  "approvalNotes": "Batch approval for valid emergencies"
}
```

### 12. Get Delivery Override Status

**GET** `/delivery/{deliveryId}/status`

**Headers:**
```
Authorization: Bearer <access_token>
```

---

## Payment Service API

**Base URL:** `/api/v1/payments`  
**Port:** 3007

### 1. Calculate Delivery Price

**POST** `/calculate-price`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "deliveryRequest": {
    "id": "request_uuid",
    "route": {
      "origin": {
        "lat": 40.7128,
        "lng": -74.0060,
        "address": "New York, NY"
      },
      "destination": {
        "lat": 42.3601,
        "lng": -71.0589,
        "address": "Boston, MA"
      }
    },
    "item": {
      "weight": 2.5,
      "dimensions": {
        "length": 30,
        "width": 20,
        "height": 10
      },
      "value": 500.00,
      "category": "electronics|documents|clothing|fragile|other",
      "fragile": true,
      "hazardous": false
    },
    "urgency": "standard|express|urgent",
    "timeWindow": {
      "pickup": {
        "start": "2025-02-01T09:00:00Z",
        "end": "2025-02-01T18:00:00Z"
      },
      "delivery": {
        "start": "2025-02-01T10:00:00Z",
        "end": "2025-02-01T20:00:00Z"
      }
    }
  },
  "trip": {
    "id": "trip_uuid",
    "type": "flight|train|bus|car",
    "departureTime": "2025-02-01T10:00:00Z",
    "arrivalTime": "2025-02-01T11:30:00Z"
  },
  "traveler": {
    "id": "traveler_uuid",
    "rating": 4.8,
    "experienceLevel": "novice|experienced|expert",
    "specializations": ["fragile_items", "electronics", "documents"]
  },
  "options": {
    "includeInsurance": true,
    "expeditedService": false,
    "whiteGloveService": false,
    "photoUpdates": true,
    "signatureRequired": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "pricing": {
      "basePrice": 15.00,
      "breakdown": {
        "baseFee": 15.00,
        "distanceFee": 15.30,
        "weightFee": 12.50,
        "urgencyMultiplier": 0.00,
        "fragileMultiplier": 4.50,
        "categoryFee": 5.00,
        "timingFee": 0.00,
        "travelerExperienceFee": 2.00,
        "insuranceFee": 5.00,
        "serviceFeesTotal": 2.50,
        "platformFee": 5.93
      },
      "subtotal": 59.30,
      "platformFee": 5.93,
      "total": 65.23,
      "currency": "USD"
    },
    "priceRange": {
      "minimum": 45.00,
      "maximum": 85.00,
      "recommended": 65.23,
      "marketAverage": 62.50
    },
    "factors": {
      "distance": {
        "km": 306,
        "impact": "high",
        "multiplier": 1.0
      },
      "weight": {
        "kg": 2.5,
        "impact": "medium",
        "multiplier": 1.0
      },
      "urgency": {
        "level": "standard",
        "impact": "none",
        "multiplier": 1.0
      },
      "timing": {
        "isPeakTime": false,
        "demandLevel": "medium",
        "multiplier": 1.0
      },
      "route": {
        "popularity": "high",
        "competition": "medium",
        "multiplier": 0.95
      },
      "item": {
        "category": "electronics",
        "fragile": true,
        "riskLevel": "medium",
        "multiplier": 1.3
      }
    },
    "recommendations": {
      "suggestedPrice": 65.23,
      "competitiveRange": {
        "min": 60.00,
        "max": 70.00
      },
      "demandForecast": "medium",
      "tips": [
        "Consider offering photo updates for better customer satisfaction",
        "Your price is competitive for this route",
        "Electronics delivery typically has higher acceptance rates"
      ]
    }
  }
}
```

### 2. Create Payment Intent

**POST** `/intents`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "deliveryId": "delivery_uuid",
  "amount": 65.23,
  "currency": "USD",
  "paymentMethod": "card|wallet|bank_transfer|crypto",
  "paymentMethodId": "pm_1234567890",
  "escrow": {
    "enabled": true,
    "releaseCondition": "delivery_confirmed|qr_scanned|manual_release",
    "holdPeriod": 24
  },
  "fees": {
    "platformFee": 5.93,
    "processingFee": 2.15,
    "insuranceFee": 5.00
  },
  "metadata": {
    "deliveryRequestId": "request_uuid",
    "tripId": "trip_uuid",
    "customerId": "customer_uuid",
    "travelerId": "traveler_uuid"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentIntentId": "pi_1234567890",
    "clientSecret": "pi_1234567890_secret_abc123",
    "status": "requires_payment_method",
    "amount": 6523,
    "currency": "usd",
    "escrow": {
      "escrowId": "escrow_uuid",
      "status": "pending",
      "releaseCondition": "delivery_confirmed",
      "holdPeriod": 24
    },
    "fees": {
      "platformFee": 593,
      "processingFee": 215,
      "insuranceFee": 500,
      "totalFees": 1308
    },
    "timeline": {
      "createdAt": "2025-02-01T10:00:00Z",
      "expiresAt": "2025-02-01T11:00:00Z"
    }
  }
}
```

### 3. Confirm Payment

**POST** `/intents/{paymentIntentId}/confirm`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "paymentMethodId": "pm_1234567890",
  "billingDetails": {
    "name": "John Smith",
    "email": "john@example.com",
    "address": {
      "line1": "123 Main St",
      "city": "New York",
      "state": "NY",
      "postalCode": "10001",
      "country": "US"
    }
  },
  "savePaymentMethod": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentIntentId": "pi_1234567890",
    "status": "succeeded",
    "chargeId": "ch_1234567890",
    "amount": 6523,
    "amountReceived": 6523,
    "escrow": {
      "escrowId": "escrow_uuid",
      "status": "held",
      "amount": 5215,
      "releaseDate": "2025-02-02T14:00:00Z"
    },
    "receipt": {
      "receiptUrl": "https://receipts.p2pdelivery.com/receipt_uuid.pdf",
      "receiptNumber": "RCP-2025-001234"
    },
    "transaction": {
      "transactionId": "txn_uuid",
      "timestamp": "2025-02-01T10:30:00Z"
    }
  }
}
```

### 4. Release Escrow Payment

**POST** `/escrow/{escrowId}/release`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "releaseReason": "delivery_confirmed|qr_scanned|manual_approval|dispute_resolved",
  "deliveryConfirmation": {
    "qrScanId": "qr_scan_uuid",
    "timestamp": "2025-02-01T14:00:00Z",
    "location": {
      "lat": 42.3601,
      "lng": -71.0589
    }
  },
  "releaseAmount": 5215,
  "deductions": {
    "damages": 0,
    "penalties": 0,
    "additionalFees": 0
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "escrowId": "escrow_uuid",
    "status": "released",
    "releaseAmount": 5215,
    "recipient": {
      "id": "traveler_uuid",
      "name": "Jane Doe",
      "accountId": "acct_1234567890"
    },
    "transaction": {
      "transferId": "tr_1234567890",
      "timestamp": "2025-02-01T14:05:00Z",
      "expectedArrival": "2025-02-02T14:05:00Z"
    },
    "receipt": {
      "payoutReceiptUrl": "https://receipts.p2pdelivery.com/payout_uuid.pdf"
    }
  }
}
```

### 5. Get Payment Status

**GET** `/intents/{paymentIntentId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 6. Cancel Payment

**POST** `/intents/{paymentIntentId}/cancel`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "reason": "customer_request|fraud_detected|technical_issue|other"
}
```

### 7. Get Payment History

**GET** `/history`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `status`: Filter by payment status
- `dateFrom`: Start date
- `dateTo`: End date
- `page`: Page number
- `limit`: Items per page

## Pricing API

**Base URL:** `/api/v1/payments/pricing`

### 1. Get Market Analysis

**GET** `/market-analysis`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `origin`: Origin location
- `destination`: Destination location
- `category`: Item category
- `timeframe`: Analysis timeframe

### 2. Optimize Pricing

**POST** `/optimize-pricing`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "deliveryRequest": {
    "route": {
      "origin": {
        "lat": 40.7128,
        "lng": -74.0060
      },
      "destination": {
        "lat": 42.3601,
        "lng": -71.0589
      }
    },
    "item": {
      "weight": 2.5,
      "category": "electronics",
      "value": 500.00
    }
  },
  "objective": "maximize_acceptance|maximize_revenue|balanced",
  "constraints": {
    "minPrice": 20.00,
    "maxPrice": 80.00
  }
}
```

### 3. Get Exchange Rates

**GET** `/exchange-rates`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `from`: Source currency code
- `to`: Target currency code
- `amount`: Amount to convert (optional)

## Webhook API

**Base URL:** `/api/v1/payments/webhooks`

### 1. Stripe Webhook Handler

**POST** `/stripe`

**Headers:**
```
Stripe-Signature: <webhook_signature>
```

**Request Body:**
```json
{
  "id": "evt_1234567890",
  "object": "event",
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_1234567890",
      "amount": 6523,
      "currency": "usd",
      "status": "succeeded"
    }
  }
}
```

---

## Location Service API

**Base URL:** `/api/v1/location`  
**Port:** 3008

### 1. Real-time Location Tracking

**POST** `/track`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "deliveryId": "delivery_uuid",
  "tripId": "trip_uuid",
  "location": {
    "lat": 40.7128,
    "lng": -74.0060,
    "accuracy": 10,
    "altitude": 15.5,
    "bearing": 45.0,
    "speed": 25.5
  },
  "timestamp": "2025-02-01T12:00:00Z",
  "batteryLevel": 85,
  "networkType": "wifi|cellular|offline",
  "deviceInfo": {
    "platform": "ios|android",
    "appVersion": "1.0.0"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "trackingId": "tracking_uuid",
    "deliveryId": "delivery_uuid",
    "status": "tracking_active",
    "location": {
      "lat": 40.7128,
      "lng": -74.0060,
      "accuracy": 10,
      "timestamp": "2025-02-01T12:00:00Z"
    },
    "route": {
      "progress": 35.5,
      "remainingDistance": 198.5,
      "estimatedArrival": "2025-02-01T14:30:00Z"
    },
    "notifications": {
      "customerNotified": true,
      "milestoneReached": "halfway_point"
    }
  }
}
```

### 2. Get Current Location

**GET** `/current/{deliveryId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "deliveryId": "delivery_uuid",
    "traveler": {
      "id": "traveler_uuid",
      "firstName": "Jane",
      "lastName": "Doe"
    },
    "currentLocation": {
      "lat": 41.2033,
      "lng": -77.1945,
      "accuracy": 15,
      "timestamp": "2025-02-01T12:30:00Z",
      "address": "Somewhere on I-80, Pennsylvania"
    },
    "route": {
      "totalDistance": 306,
      "remainingDistance": 165.5,
      "progress": 45.9,
      "estimatedArrival": "2025-02-01T14:15:00Z",
      "delayStatus": "on_time|delayed|early",
      "delayMinutes": 0
    },
    "status": "in_transit",
    "lastUpdate": "2025-02-01T12:30:00Z",
    "batteryLevel": 78,
    "networkStatus": "good"
  }
}
```

### 3. Route Optimization

**POST** `/route/optimize`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "origin": {
    "lat": 40.7128,
    "lng": -74.0060,
    "address": "New York, NY"
  },
  "destination": {
    "lat": 42.3601,
    "lng": -71.0589,
    "address": "Boston, MA"
  },
  "waypoints": [
    {
      "lat": 40.9176,
      "lng": -74.1718,
      "type": "pickup|delivery|stop",
      "timeWindow": {
        "start": "2025-02-01T11:00:00Z",
        "end": "2025-02-01T12:00:00Z"
      },
      "duration": 10
    }
  ],
  "preferences": {
    "avoidTolls": false,
    "avoidHighways": false,
    "optimize": "time|distance|fuel",
    "vehicleType": "car|truck|motorcycle"
  },
  "constraints": {
    "maxDetour": 20,
    "maxTimeIncrease": 30
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "optimizedRoute": {
      "totalDistance": 315.2,
      "totalDuration": 195,
      "totalDetour": 9.2,
      "fuelCost": 25.50,
      "tollCost": 8.75
    },
    "segments": [
      {
        "from": {
          "lat": 40.7128,
          "lng": -74.0060,
          "address": "New York, NY"
        },
        "to": {
          "lat": 40.9176,
          "lng": -74.1718,
          "address": "Newark, NJ"
        },
        "distance": 18.5,
        "duration": 25,
        "instructions": "Take I-95 North towards Newark"
      }
    ],
    "waypoints": [
      {
        "lat": 40.9176,
        "lng": -74.1718,
        "type": "pickup",
        "estimatedArrival": "2025-02-01T11:25:00Z",
        "estimatedDeparture": "2025-02-01T11:35:00Z",
        "address": "Newark, NJ"
      }
    ],
    "alternatives": [
      {
        "name": "Fastest Route",
        "distance": 306.0,
        "duration": 180,
        "savings": {
          "time": "15 minutes",
          "distance": "9.2 km"
        }
      }
    ],
    "polyline": "encoded_polyline_string",
    "bbox": {
      "north": 42.4,
      "south": 40.7,
      "east": -71.0,
      "west": -74.2
    }
  }
}
```

### 4. Geocoding Service

**GET** `/geocode`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `address`: Address to geocode
- `lat`: Latitude for reverse geocoding
- `lng`: Longitude for reverse geocoding
- `type`: forward|reverse
- `country`: Country code filter (optional)
- `limit`: Maximum results (default: 5)

**Response:**
```json
{
  "success": true,
  "data": {
    "query": "123 Main St, New York, NY",
    "results": [
      {
        "formattedAddress": "123 Main St, New York, NY 10001, USA",
        "location": {
          "lat": 40.7128,
          "lng": -74.0060
        },
        "addressComponents": {
          "streetNumber": "123",
          "streetName": "Main St",
          "city": "New York",
          "state": "NY",
          "postalCode": "10001",
          "country": "USA",
          "countryCode": "US"
        },
        "placeId": "place_uuid",
        "confidence": 0.95,
        "accuracy": "rooftop",
        "types": ["street_address"]
      }
    ],
    "bounds": {
      "north": 40.7138,
      "south": 40.7118,
      "east": -74.0050,
      "west": -74.0070
    }
  }
}
```

### 5. Get Location History

**GET** `/history/{deliveryId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `startTime`: Start time filter
- `endTime`: End time filter
- `page`: Page number
- `limit`: Items per page

### 6. Find Nearby Travelers

**GET** `/travelers/nearby`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `lat`: Latitude
- `lng`: Longitude
- `radius`: Search radius in km
- `userType`: Filter by user type
- `minRating`: Minimum rating

### 7. Get ETA Updates

**GET** `/eta/{deliveryId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 8. Get Location Analytics

**GET** `/analytics`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `period`: Time period
- `deliveryId`: Filter by delivery
- `userId`: Filter by user

## Geocoding Extended API

**Base URL:** `/api/v1/location/geocode`

### 1. Batch Geocoding

**POST** `/batch`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "requests": [
    {
      "address": "123 Main St, New York, NY",
      "type": "forward"
    },
    {
      "lat": 40.7128,
      "lng": -74.0060,
      "type": "reverse"
    }
  ]
}
```

### 2. Get Address Suggestions

**GET** `/suggestions`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `input`: Search input (minimum 2 characters)
- `country`: Country filter
- `limit`: Maximum results

### 3. Get Place Details

**GET** `/place/{placeId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

## Route Optimization API

**Base URL:** `/api/v1/location/route`

### 1. Get Route Traffic

**GET** `/{routeId}/traffic`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 2. Get Traffic Information

**GET** `/traffic`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `route`: Route identifier
- `origin`: Origin coordinates
- `destination`: Destination coordinates
- `departureTime`: Departure time

## Geofence Management API

**Base URL:** `/api/v1/location/geofence`

### 1. Create Geofence

**POST** `/`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "name": "Pickup Zone",
  "type": "circular|polygon",
  "center": {
    "lat": 40.7128,
    "lng": -74.0060
  },
  "radius": 100,
  "deliveryId": "delivery_uuid",
  "events": ["enter", "exit"],
  "active": true
}
```

### 2. Get Active Geofences

**GET** `/active`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `deliveryId`: Filter by delivery
- `type`: Filter by type
- `lat`: Location latitude
- `lng`: Location longitude

### 3. Update Geofence

**PUT** `/{geofenceId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "name": "Updated Geofence Name",
  "radius": 150,
  "active": false
}
```

### 4. Delete Geofence

**DELETE** `/{geofenceId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 5. Check Geofence Status

**POST** `/check`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "location": {
    "lat": 40.7128,
    "lng": -74.0060
  },
  "deliveryId": "delivery_uuid"
}
```

### 6. Get Geofence Events

**GET** `/{geofenceId}/events`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 7. Get Geofence Statistics

**GET** `/{geofenceId}/stats`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 8. Create Delivery Geofences

**POST** `/delivery`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "deliveryId": "delivery_uuid",
  "pickupLocation": {
    "lat": 40.7128,
    "lng": -74.0060
  },
  "deliveryLocation": {
    "lat": 42.3601,
    "lng": -71.0589
  },
  "radius": 100
}
```

### 9. Get Geofence Recommendations

**GET** `/recommendations`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `lat`: Location latitude
- `lng`: Location longitude
- `deliveryType`: Type of delivery

## Emergency Location API

**Base URL:** `/api/v1/location/emergency`

### 1. Report Emergency

**POST** `/`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "type": "medical|accident|theft|harassment|other",
  "severity": "low|medium|high|critical",
  "location": {
    "lat": 40.7128,
    "lng": -74.0060,
    "accuracy": 10
  },
  "deliveryId": "delivery_uuid",
  "description": "Emergency description",
  "contactInfo": {
    "phone": "+1234567890",
    "emergencyContact": "+0987654321"
  }
}
```

### 2. Update Emergency Status

**PUT** `/{emergencyId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "status": "reported|responding|resolved|cancelled",
  "notes": "Status update notes",
  "responderInfo": {
    "name": "Emergency Responder",
    "contact": "+1234567890"
  }
}
```

### 3. Get Nearby Emergency Services

**GET** `/services`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `lat`: Location latitude
- `lng`: Location longitude
- `radius`: Search radius
- `type`: Service type (police|hospital|fire|all)

### 4. Get Emergency Details

**GET** `/{emergencyId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 5. Get Emergency History

**GET** `/history`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 6. Get Emergency Statistics

**GET** `/stats`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 7. Get Active Emergencies (Admin)

**GET** `/active`

**Headers:**
```
Authorization: Bearer <access_token>
```

## Privacy Management API

**Base URL:** `/api/v1/location/privacy`

### 1. Update Privacy Settings

**PUT** `/`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "trackingLevel": "precise|approximate|city_level|disabled",
  "shareWith": {
    "customers": true,
    "platform": true,
    "emergencyContacts": true,
    "thirdParties": false
  },
  "dataRetention": {
    "period": 90,
    "deleteAfterDelivery": false
  },
  "anonymization": {
    "enabled": true,
    "delay": 24
  }
}
```

### 2. Get Privacy Settings

**GET** `/`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 3. Export Location Data

**POST** `/export`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "format": "json|csv|xml",
  "dateRange": {
    "startDate": "2025-01-01T00:00:00Z",
    "endDate": "2025-02-01T00:00:00Z"
  }
}
```

### 4. Get Export Status

**GET** `/export/{exportId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 5. Delete Location Data

**DELETE** `/data`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "confirmDeletion": true,
  "retainDays": 0
}
```

### 6. Anonymize Data

**POST** `/anonymize`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "olderThanDays": 30,
  "preserveAggregates": true
}
```

### 7. Get Privacy Audit Log

**GET** `/audit`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `limit`: Maximum results
- `offset`: Results offset

---

## Notification Service API

**Base URL:** `/api/v1/notifications`  
**Port:** 3009

### 1. Send Push Notification

**POST** `/push`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Request Body:**
```json
{
  "recipients": [
    {
      "userId": "user_uuid",
      "deviceTokens": ["fcm_token_1", "fcm_token_2"],
      "platform": "ios|android|web"
    }
  ],
  "notification": {
    "title": "Delivery Update",
    "body": "Your package has been picked up and is on its way!",
    "icon": "https://cdn.p2pdelivery.com/icons/pickup.png",
    "image": "https://cdn.p2pdelivery.com/images/delivery-truck.jpg",
    "sound": "default|custom_sound.wav",
    "badge": 5,
    "category": "delivery_update",
    "priority": "high|normal|low"
  },
  "data": {
    "type": "delivery_update",
    "deliveryId": "delivery_uuid",
    "status": "picked_up",
    "deepLink": "p2pdelivery://delivery/delivery_uuid",
    "customData": {
      "trackingUrl": "https://track.p2pdelivery.com/delivery_uuid",
      "estimatedArrival": "2025-02-01T14:30:00Z"
    }
  },
  "targeting": {
    "userTypes": ["customer", "traveler"],
    "locations": [
      {
        "lat": 40.7128,
        "lng": -74.0060,
        "radius": 10000
      }
    ],
    "segments": ["premium_users", "frequent_customers"]
  },
  "scheduling": {
    "sendAt": "2025-02-01T13:00:00Z",
    "timezone": "America/New_York"
  },
  "options": {
    "collapse_key": "delivery_updates",
    "time_to_live": 3600,
    "dry_run": false,
    "analytics": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "notificationId": "notification_uuid",
    "status": "sent",
    "recipientCount": 2,
    "results": [
      {
        "userId": "user_uuid",
        "deviceToken": "fcm_token_1",
        "status": "success",
        "messageId": "msg_uuid_1"
      },
      {
        "userId": "user_uuid",
        "deviceToken": "fcm_token_2",
        "status": "failed",
        "error": "invalid_token"
      }
    ],
    "analytics": {
      "sent": 1,
      "failed": 1,
      "failureReasons": {
        "invalid_token": 1
      }
    },
    "sentAt": "2025-02-01T12:00:00Z"
  }
}
```

### 2. Send Email Notification

**POST** `/email`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "recipients": [
    {
      "email": "user@example.com",
      "name": "John Doe",
      "userId": "user_uuid"
    }
  ],
  "email": {
    "subject": "Your Delivery is On Its Way!",
    "templateId": "delivery_update_template",
    "templateData": {
      "customerName": "John",
      "deliveryId": "DEL-001234",
      "itemName": "Legal Documents",
      "travelerName": "Jane Doe",
      "estimatedArrival": "2025-02-01T14:30:00Z",
      "trackingUrl": "https://track.p2pdelivery.com/delivery_uuid"
    },
    "htmlContent": "<html>...</html>",
    "textContent": "Plain text version...",
    "attachments": [
      {
        "filename": "receipt.pdf",
        "content": "base64_encoded_content",
        "contentType": "application/pdf"
      }
    ]
  },
  "options": {
    "priority": "high|normal|low",
    "tracking": {
      "opens": true,
      "clicks": true,
      "unsubscribes": true
    },
    "sendAt": "2025-02-01T13:00:00Z",
    "timezone": "America/New_York"
  },
  "branding": {
    "fromName": "P2P Delivery",
    "fromEmail": "noreply@p2pdelivery.com",
    "replyTo": "support@p2pdelivery.com"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "emailId": "email_uuid",
    "status": "sent",
    "recipientCount": 1,
    "results": [
      {
        "email": "user@example.com",
        "status": "accepted",
        "messageId": "msg_uuid"
      }
    ],
    "sentAt": "2025-02-01T12:00:00Z",
    "tracking": {
      "trackingId": "track_uuid",
      "trackingUrl": "https://track.p2pdelivery.com/email/track_uuid"
    }
  }
}
```

### 3. Get User Notifications

**GET** `/user/{userId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `type`: Filter by type (push|email|sms|in_app)
- `status`: Filter by status (sent|delivered|read|failed)
- `category`: Filter by category
- `dateFrom`: Date range start
- `dateTo`: Date range end
- `page`: Page number
- `limit`: Items per page

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "notification_uuid",
      "type": "push",
      "category": "delivery_update",
      "title": "Delivery Update",
      "message": "Your package has been picked up and is on its way!",
      "status": "delivered",
      "sentAt": "2025-02-01T12:00:00Z",
      "deliveredAt": "2025-02-01T12:00:05Z",
      "readAt": "2025-02-01T12:05:00Z",
      "data": {
        "deliveryId": "delivery_uuid",
        "trackingUrl": "https://track.p2pdelivery.com/delivery_uuid"
      },
      "actions": [
        {
          "id": "track_delivery",
          "label": "Track Delivery",
          "clicked": true,
          "clickedAt": "2025-02-01T12:06:00Z"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  },
  "summary": {
    "unread": 3,
    "total": 45,
    "byType": {
      "push": 25,
      "email": 15,
      "sms": 3,
      "in_app": 2
    }
  }
}
```

### 4. Send Custom Notification

**POST** `/send-custom`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "recipients": ["user_uuid_1", "user_uuid_2"],
  "channels": ["push", "email"],
  "title": "Custom Notification",
  "message": "Custom message content",
  "data": {
    "customField": "customValue"
  },
  "priority": "high|normal|low",
  "sendAt": "2025-02-01T15:00:00Z"
}
```

### 5. Send Bulk Notifications (Admin)

**POST** `/send-bulk`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "targeting": {
    "userTypes": ["customer", "traveler"],
    "locations": [
      {
        "lat": 40.7128,
        "lng": -74.0060,
        "radius": 10000
      }
    ],
    "segments": ["premium_users"]
  },
  "notification": {
    "title": "Platform Update",
    "body": "New features available!",
    "channels": ["push", "email"]
  },
  "scheduling": {
    "sendAt": "2025-02-01T12:00:00Z",
    "timezone": "America/New_York"
  }
}
```

### 6. Test Notification (Admin)

**POST** `/test`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "userId": "test_user_uuid",
  "channel": "push|email|sms",
  "template": "delivery_update",
  "testData": {
    "deliveryId": "test_delivery_uuid"
  }
}
```

### 7. Mark as Read

**POST** `/{notificationId}/read`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 8. Mark as Clicked

**POST** `/{notificationId}/clicked`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "actionId": "track_delivery",
  "metadata": {
    "source": "notification_center"
  }
}
```

### 9. Mark All as Read

**PUT** `/user/{userId}/read-all`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 10. Delete Notification

**DELETE** `/{notificationId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 11. Register Device Token

**POST** `/device-tokens`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "token": "fcm_device_token",
  "platform": "ios|android|web",
  "appVersion": "1.0.0",
  "deviceInfo": {
    "model": "iPhone 14",
    "osVersion": "16.0"
  }
}
```

### 12. Update Device Token

**PUT** `/device-tokens/{tokenId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "token": "updated_fcm_token",
  "active": true
}
```

### 13. Get Notification Statistics

**GET** `/stats/{userId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 14. Health Check

**GET** `/health`

## Notification Preferences API

**Base URL:** `/api/v1/notifications/preferences`

### 1. Get User Preferences

**GET** `/{userId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 2. Update User Preferences

**PUT** `/{userId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "channels": {
    "push": {
      "enabled": true,
      "categories": {
        "delivery_updates": true,
        "marketing": false,
        "system_alerts": true
      }
    },
    "email": {
      "enabled": true,
      "categories": {
        "delivery_updates": true,
        "marketing": true,
        "system_alerts": true
      }
    },
    "sms": {
      "enabled": false,
      "categories": {
        "delivery_updates": false,
        "marketing": false,
        "system_alerts": true
      }
    }
  },
  "quietHours": {
    "enabled": true,
    "startTime": "22:00",
    "endTime": "08:00",
    "timezone": "America/New_York"
  }
}
```

### 3. Update Channel Preferences

**PUT** `/{userId}/channels/{channel}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "enabled": true,
  "categories": {
    "delivery_updates": true,
    "marketing": false
  }
}
```

### 4. Update Quiet Hours

**PUT** `/{userId}/quiet-hours`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "enabled": true,
  "startTime": "23:00",
  "endTime": "07:00",
  "timezone": "America/New_York",
  "emergencyOverride": true
}
```

### 5. Get User Settings

**GET** `/{userId}/settings`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 6. Update User Setting

**PUT** `/{userId}/settings/{settingKey}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "value": "setting_value"
}
```

### 7. Bulk Update Settings

**PUT** `/{userId}/settings`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "language": "en",
  "frequency": "immediate|hourly|daily",
  "groupSimilar": true
}
```

### 8. Reset Preferences

**POST** `/{userId}/reset`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 9. Export Preferences

**GET** `/{userId}/export`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 10. Import Preferences

**POST** `/{userId}/import`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "preferences": {
    "channels": {},
    "quietHours": {},
    "settings": {}
  }
}
```

### 11. Get Preference Statistics (Admin)

**GET** `/stats/overview`

**Headers:**
```
Authorization: Bearer <access_token>
```

---

## Admin Service API

**Base URL:** `/api/v1/admin`  
**Port:** 3010

**Note**: All admin endpoints require `X-Admin-Token` header with valid admin authentication token.

### 1. Admin Dashboard Overview

**GET** `/dashboard`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalUsers": 12450,
      "activeUsers": 8932,
      "totalDeliveries": 45620,
      "activeDeliveries": 234,
      "totalRevenue": 1245067.50,
      "monthlyRevenue": 125450.75,
      "platformGrowth": "+12.5%"
    },
    "realtimeMetrics": {
      "onlineUsers": 1245,
      "activeDeliveries": 234,
      "newSignups": 45,
      "completedDeliveries": 156,
      "systemLoad": "normal",
      "serverStatus": "healthy"
    },
    "alerts": [
      {
        "id": "alert_uuid",
        "type": "high_refund_rate",
        "severity": "medium",
        "message": "Refund rate increased by 15% in the last 24 hours",
        "count": 23,
        "timestamp": "2025-02-01T12:00:00Z"
      }
    ],
    "quickStats": {
      "newUsers": {
        "today": 45,
        "week": 312,
        "month": 1456
      },
      "deliveries": {
        "today": 156,
        "week": 1234,
        "month": 5678
      },
      "revenue": {
        "today": 5234.50,
        "week": 45678.90,
        "month": 125450.75
      }
    }
  }
}
```

### 2. User Management

**GET** `/users`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Query Parameters:**
- `search`: Search by name, email, or ID
- `status`: Filter by status (active|suspended|banned|pending)
- `userType`: Filter by type (customer|traveler|both)
- `verificationLevel`: Filter by verification level
- `registrationDate`: Filter by registration date range
- `sortBy`: Sort by (created|lastActive|rating|deliveries)
- `page`: Page number
- `limit`: Items per page

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "user_uuid",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "phoneNumber": "+1234567890",
      "userType": "traveler",
      "status": "active",
      "verificationLevel": "verified",
      "rating": {
        "average": 4.8,
        "count": 156
      },
      "statistics": {
        "totalDeliveries": 156,
        "successRate": 98.7,
        "totalEarnings": 5234.50,
        "joinedDate": "2024-01-15T00:00:00Z",
        "lastActive": "2025-02-01T10:30:00Z"
      },
      "flags": {
        "isVip": false,
        "hasWarnings": false,
        "riskLevel": "low"
      },
      "location": {
        "city": "New York",
        "country": "USA",
        "timezone": "America/New_York"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 12450,
    "totalPages": 249
  }
}
```

### 3. Update User Status

**PUT** `/users/{userId}/status`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Request Body:**
```json
{
  "status": "active|suspended|banned|pending",
  "reason": "violation_of_terms|suspicious_activity|user_request|other",
  "description": "Suspended due to multiple customer complaints",
  "duration": 7,
  "notifyUser": true,
  "internalNotes": "Multiple complaints about late deliveries"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user_uuid",
    "previousStatus": "active",
    "newStatus": "suspended",
    "reason": "violation_of_terms",
    "effectiveDate": "2025-02-01T12:00:00Z",
    "expirationDate": "2025-02-08T12:00:00Z",
    "actionBy": "admin_uuid",
    "notificationSent": true
  }
}
```

### 4. System Configuration

**GET** `/config`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "platform": {
      "maintenanceMode": false,
      "registrationEnabled": true,
      "apiRateLimit": 1000,
      "maxFileUploadSize": 10,
      "supportedCountries": ["US", "CA", "UK", "DE", "FR"],
      "defaultCurrency": "USD",
      "platformFeeRate": 0.10
    },
    "features": {
      "realTimeTracking": true,
      "qrCodeVerification": true,
      "autoMatching": true,
      "instantPayouts": true,
      "multiLanguageSupport": true
    },
    "limits": {
      "maxDeliveryValue": 5000.00,
      "maxDeliveryWeight": 25.0,
      "maxDeliveryDistance": 1000,
      "maxActiveDeliveries": 10
    },
    "notifications": {
      "emailEnabled": true,
      "smsEnabled": true,
      "pushEnabled": true,
      "webhooksEnabled": true
    },
    "security": {
      "twoFactorRequired": false,
      "passwordMinLength": 8,
      "sessionTimeout": 3600,
      "maxLoginAttempts": 5
    }
  }
}
```

### 5. Get User Details

**GET** `/users/{userId}`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

## Analytics API

**Base URL:** `/api/v1/admin/analytics`

### 1. Get System Analytics

**GET** `/system`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Query Parameters:**
- `period`: Time period (day|week|month|quarter|year)
- `startDate`: Start date
- `endDate`: End date

### 2. Export Analytics Data

**POST** `/export`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Request Body:**
```json
{
  "dataTypes": ["users", "deliveries", "transactions"],
  "format": "csv|json|xlsx",
  "dateRange": {
    "startDate": "2025-01-01T00:00:00Z",
    "endDate": "2025-02-01T00:00:00Z"
  },
  "filters": {
    "userTypes": ["customer", "traveler"],
    "status": ["active", "completed"]
  }
}
```

## Dispute Management API

**Base URL:** `/api/v1/admin/disputes`

### 1. Get Disputes

**GET** `/`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Query Parameters:**
- `status`: Filter by status (open|under_review|resolved|escalated)
- `priority`: Filter by priority (low|medium|high|critical)
- `assignedTo`: Filter by assigned admin
- `page`: Page number
- `limit`: Items per page

### 2. Get Dispute Details

**GET** `/{disputeId}`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

### 3. Assign Dispute

**PUT** `/{disputeId}/assign`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Request Body:**
```json
{
  "assignedTo": "admin_uuid",
  "priority": "high",
  "notes": "Urgent dispute requiring immediate attention"
}
```

### 4. Resolve Dispute

**PUT** `/{disputeId}/resolve`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Request Body:**
```json
{
  "resolution": "customer_favor|traveler_favor|partial_refund|no_action",
  "refundAmount": 25.00,
  "notes": "Resolution details and reasoning",
  "compensations": {
    "customer": 25.00,
    "traveler": 0.00
  }
}
```

## Financial Management API

**Base URL:** `/api/v1/admin/finance`

### 1. Get Financial Overview

**GET** `/overview`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Query Parameters:**
- `period`: Time period
- `currency`: Currency filter

### 2. Get Transactions

**GET** `/transactions`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Query Parameters:**
- `status`: Transaction status
- `type`: Transaction type
- `minAmount`: Minimum amount
- `maxAmount`: Maximum amount
- `dateFrom`: Start date
- `dateTo`: End date
- `page`: Page number
- `limit`: Items per page

### 3. Manual Payout

**POST** `/payouts/manual`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Request Body:**
```json
{
  "travelerId": "traveler_uuid",
  "amount": 150.00,
  "currency": "USD",
  "reason": "manual_adjustment|bonus|compensation|other",
  "description": "Manual payout for exceptional service",
  "reference": "MANUAL_PAYOUT_001"
}
```

## System Management API

**Base URL:** `/api/v1/admin/system`

### 1. Update System Configuration

**PUT** `/config`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Request Body:**
```json
{
  "platform": {
    "maintenanceMode": false,
    "registrationEnabled": true,
    "apiRateLimit": 1500
  },
  "features": {
    "realTimeTracking": true,
    "autoMatching": false
  },
  "limits": {
    "maxDeliveryValue": 6000.00,
    "maxDeliveryWeight": 30.0
  }
}
```

### 2. Create System Backup

**POST** `/backups`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Request Body:**
```json
{
  "type": "full|incremental|database_only",
  "description": "Weekly full backup",
  "compression": true,
  "encryption": true
}
```

### 3. Get System Backups

**GET** `/backups`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Query Parameters:**
- `type`: Backup type
- `status`: Backup status
- `page`: Page number
- `limit`: Items per page

---

## 📊 API Summary Statistics

| Service | Endpoints | Key Features |
|---------|-----------|--------------|
| Authentication | 32 endpoints | JWT, 2FA, Social Login, Session Management, Account Management |
| User Management | 45 endpoints | Profiles, Verification, Reviews, Favorites, Addresses, Preferences |
| Trip Management | 42 endpoints | CRUD, Templates, Analytics, Weather, Capacity Management |
| Delivery Requests | 28 endpoints | Matching, Offers, Market Analysis, Request Management |
| QR Code System | 35 endpoints | Generation, Validation, Security Audit, Emergency Override |
| Payment System | 15 endpoints | Pricing, Escrow, Webhooks, Market Analysis |
| Location Services | 38 endpoints | Tracking, Geofencing, Route Optimization, Privacy, Emergency |
| Notifications | 25 endpoints | Multi-channel, Templates, Preferences, Analytics |
| Admin Dashboard | 18 endpoints | Management, Monitoring, Configuration, Analytics, Disputes |

**Total: 278 Comprehensive Endpoints**

---

## 🔐 Security Features

### Authentication & Authorization
- JWT tokens with configurable expiration
- Refresh token rotation
- Role-based access control (RBAC)
- API key management for admin functions
- Rate limiting per user tier

### Data Protection
- End-to-end encryption for sensitive data
- PII anonymization after delivery completion
- GDPR compliance features
- Secure file upload with virus scanning
- Audit logging for all admin actions

### QR Code Security
- Military-grade encryption
- Blockchain verification
- Time-based expiration
- Location-bound validation
- Emergency override with admin approval

---

## 📱 Response Formats

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Optional success message",
  "meta": {
    // Optional metadata (pagination, etc.)
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {
      // Additional error details
    }
  },
  "requestId": "request_uuid"
}
```

---

## 🔄 Common HTTP Status Codes

- `200 OK` - Request successful
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Access denied
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - Service temporarily unavailable

---

This comprehensive API documentation covers all 173 endpoints across the 9 microservices with detailed request/response examples, making it easy for developers to integrate with the P2P Delivery Platform.