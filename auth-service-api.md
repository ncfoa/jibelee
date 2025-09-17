# Authentication Service API

Base URL: `/api/v1/auth`

## Endpoints

### 1. User Registration

**POST** `/register`

Register a new user account.

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
  "referralCode": "REF123" // Optional
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

### 3. Resend Verification Code

**POST** `/resend-verification`

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

### 4. Login

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
    "pushToken": "fcm_token" // Optional for notifications
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

### 5. Social Login

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
  "deviceId": "device_uuid", // Optional, to logout from specific device
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

### 11. Two-Factor Authentication Setup

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

### 12. Two-Factor Authentication Verify

**POST** `/2fa/verify`

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

### 13. Two-Factor Authentication Login

**POST** `/2fa/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "twoFactorCode": "123456"
}
```

### 14. Validate Token

**GET** `/validate`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "userType": "traveler",
      "permissions": ["read:profile", "write:trips"]
    },
    "expiresAt": "2025-01-01T01:00:00Z"
  }
}
```

### 15. Get User Sessions

**GET** `/sessions`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "session_uuid",
        "deviceId": "device_uuid",
        "deviceType": "mobile",
        "platform": "ios",
        "ipAddress": "192.168.1.1",
        "location": "New York, US",
        "lastActive": "2025-01-01T00:00:00Z",
        "current": true
      }
    ]
  }
}
```

### 16. Revoke Session

**DELETE** `/sessions/{sessionId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 17. Account Deactivation

**POST** `/deactivate`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "reason": "privacy_concerns|not_useful|too_expensive|other",
  "feedback": "Optional feedback text",
  "password": "CurrentPass123!"
}
```

### 18. Account Deletion Request

**POST** `/delete-account`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "reason": "privacy_concerns|not_useful|too_expensive|other",
  "feedback": "Optional feedback text",
  "password": "CurrentPass123!",
  "confirmDeletion": true
}
```

## Security Features

### Rate Limiting
- Login attempts: 5 per 15 minutes per IP
- Registration: 3 per hour per IP
- Password reset: 3 per hour per email
- Verification code: 5 per hour per email

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character
- Cannot contain email or name

### JWT Token Structure
```json
{
  "sub": "user_uuid",
  "email": "user@example.com",
  "userType": "traveler",
  "permissions": ["read:profile", "write:trips"],
  "iat": 1640995200,
  "exp": 1640998800,
  "deviceId": "device_uuid"
}
```