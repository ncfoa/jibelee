# Admin Service - Detailed Architecture

## 🏗️ Service Overview

The Admin Service provides comprehensive administrative operations and system management for the P2P Delivery Platform. It includes real-time monitoring, user management, financial reporting, dispute resolution, content moderation, and system configuration capabilities.

**Port:** 3010  
**Base URL:** `/api/v1/admin`  
**Database:** `admin_db` (PostgreSQL)

## 🎯 Core Responsibilities

### Primary Functions
- **System Monitoring**: Real-time platform health and performance monitoring
- **User Management**: Complete user lifecycle management and moderation
- **Financial Operations**: Revenue tracking, payout management, and financial reporting
- **Dispute Resolution**: Comprehensive dispute management and resolution tools
- **Content Moderation**: Review and moderation system for user-generated content
- **Analytics & Reporting**: Business intelligence and operational insights
- **System Configuration**: Platform settings and feature flag management
- **Security Management**: Security monitoring, incident response, and compliance

### Key Features
- **Real-time Dashboard**: Live system metrics and alerts
- **Advanced Analytics**: Custom reports and data visualization
- **Role-based Access Control**: Granular permission management
- **Audit Trail**: Complete activity logging and compliance tracking
- **Automated Workflows**: Intelligent automation for common tasks
- **Multi-tenant Architecture**: Support for multiple admin organizations

## 🗄️ Database Schema

### Core Tables

#### 1. Admin Users Table
```sql
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    role admin_role_enum NOT NULL,
    permissions TEXT[] DEFAULT '{}',
    
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID
);
```

#### 2. Admin Activity Log Table
```sql
CREATE TABLE admin_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    
    description TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. System Configuration Table
```sql
CREATE TABLE system_configuration (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(50) NOT NULL,
    key VARCHAR(100) NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    
    is_sensitive BOOLEAN DEFAULT FALSE,
    requires_restart BOOLEAN DEFAULT FALSE,
    
    updated_by UUID NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 4. Disputes Table
```sql
CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID NOT NULL,
    payment_intent_id UUID,
    
    case_number VARCHAR(50) UNIQUE NOT NULL,
    category dispute_category_enum NOT NULL,
    priority dispute_priority_enum NOT NULL DEFAULT 'medium',
    status dispute_status_enum NOT NULL DEFAULT 'open',
    
    complainant_id UUID NOT NULL,
    respondent_id UUID NOT NULL,
    
    amount INTEGER, -- disputed amount in cents
    currency VARCHAR(3) DEFAULT 'USD',
    
    description TEXT NOT NULL,
    requested_resolution dispute_resolution_enum,
    
    assignee_id UUID,
    assigned_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_date TIMESTAMP,
    resolved_at TIMESTAMP,
    resolution_notes TEXT
);
```

#### 5. Dispute Evidence Table
```sql
CREATE TABLE dispute_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dispute_id UUID NOT NULL,
    submitted_by UUID NOT NULL,
    evidence_type evidence_type_enum NOT NULL,
    file_url VARCHAR(500),
    description TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 6. Dispute Messages Table
```sql
CREATE TABLE dispute_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dispute_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    message TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE, -- Internal admin notes
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 7. System Backups Table
```sql
CREATE TABLE system_backups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    backup_type backup_type_enum NOT NULL,
    status backup_status_enum NOT NULL DEFAULT 'in_progress',
    
    size_bytes BIGINT,
    file_path VARCHAR(500),
    download_url VARCHAR(500),
    
    description TEXT,
    include_uploads BOOLEAN DEFAULT TRUE,
    include_logs BOOLEAN DEFAULT FALSE,
    
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    expires_at TIMESTAMP,
    
    created_by UUID
);
```

#### 8. Data Exports Table
```sql
CREATE TABLE data_exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    export_type VARCHAR(50) NOT NULL,
    format export_format_enum NOT NULL,
    status export_status_enum NOT NULL DEFAULT 'processing',
    
    filters JSONB DEFAULT '{}',
    fields TEXT[],
    
    estimated_records INTEGER,
    actual_records INTEGER,
    file_size_bytes BIGINT,
    
    download_url VARCHAR(500),
    expires_at TIMESTAMP,
    
    requested_by UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);
```

#### 9. Daily Metrics Table
```sql
CREATE TABLE daily_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    metric_type VARCHAR(50) NOT NULL,
    
    -- User metrics
    new_users INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    deleted_users INTEGER DEFAULT 0,
    
    -- Delivery metrics
    new_requests INTEGER DEFAULT 0,
    matched_requests INTEGER DEFAULT 0,
    completed_deliveries INTEGER DEFAULT 0,
    cancelled_deliveries INTEGER DEFAULT 0,
    
    -- Financial metrics
    total_revenue DECIMAL(15,2) DEFAULT 0.00,
    platform_fees DECIMAL(15,2) DEFAULT 0.00,
    refunds DECIMAL(15,2) DEFAULT 0.00,
    
    -- Performance metrics
    average_response_time INTEGER DEFAULT 0, -- milliseconds
    success_rate DECIMAL(5,2) DEFAULT 0.00,
    
    -- System metrics
    api_calls INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Enums
```sql
CREATE TYPE admin_role_enum AS ENUM (
    'super_admin', 'admin', 'moderator', 'support', 'finance', 'analyst'
);

CREATE TYPE dispute_category_enum AS ENUM (
    'item_not_delivered', 'item_damaged', 'service_not_as_described', 
    'unauthorized_charge', 'payment_issue', 'other'
);

CREATE TYPE dispute_priority_enum AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TYPE dispute_status_enum AS ENUM (
    'open', 'under_review', 'awaiting_response', 'resolved', 'escalated', 'closed'
);

CREATE TYPE dispute_resolution_enum AS ENUM (
    'full_refund', 'partial_refund', 'replacement', 'compensation', 'no_action'
);

CREATE TYPE evidence_type_enum AS ENUM ('photo', 'video', 'document', 'audio', 'text');

CREATE TYPE backup_type_enum AS ENUM ('full', 'incremental', 'database_only', 'files_only');

CREATE TYPE backup_status_enum AS ENUM ('in_progress', 'completed', 'failed', 'expired');

CREATE TYPE export_format_enum AS ENUM ('csv', 'json', 'xlsx', 'xml');

CREATE TYPE export_status_enum AS ENUM ('processing', 'completed', 'failed', 'expired');
```

## 🔧 Technology Stack

### Backend Framework
```javascript
// Node.js with Express.js or Python with Django
const express = require('express');
const socket = require('socket.io');
const bull = require('bull');
const moment = require('moment');
const csv = require('csv-parser');
const xlsx = require('xlsx');
```

### Key Dependencies
- **Express.js/Django**: Web framework
- **Socket.io**: Real-time dashboard updates
- **Bull Queue**: Background job processing
- **Chart.js/D3.js**: Data visualization
- **CSV/Excel**: Data export capabilities
- **PDF Generation**: Report generation
- **Winston**: Comprehensive logging
- **Redis**: Caching and session management

### Frontend Framework
```javascript
// React.js with Material-UI or Vue.js with Vuetify
import React from 'react';
import { MaterialUI } from '@material-ui/core';
import { Chart } from 'chart.js';
import { DataGrid } from '@material-ui/data-grid';
import { Socket } from 'socket.io-client';
```

## 📊 API Endpoints (20 Total)

### Dashboard & Analytics Endpoints

#### 1. Get Dashboard Overview
```http
GET /api/v1/admin/dashboard
Authorization: Bearer <admin_access_token>
Query Parameters:
- period: today|week|month|quarter|year
- timezone: America/New_York
```

#### 2. Get System Health
```http
GET /api/v1/admin/system/health
Authorization: Bearer <admin_access_token>
```

#### 3. Get Real-time Metrics
```http
GET /api/v1/admin/metrics/realtime
Authorization: Bearer <admin_access_token>
```

#### 4. Get Custom Analytics
```http
POST /api/v1/admin/analytics/custom
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "metrics": ["user_registrations", "completed_deliveries", "revenue"],
  "dimensions": ["date", "country", "user_type"],
  "filters": {
    "dateRange": {
      "start": "2025-01-01",
      "end": "2025-01-31"
    },
    "country": ["US", "CA", "UK"],
    "userType": ["customer", "traveler"]
  },
  "groupBy": "day",
  "limit": 1000
}
```

### User Management Endpoints

#### 5. Get Users
```http
GET /api/v1/admin/users
Authorization: Bearer <admin_access_token>
Query Parameters:
- status: active|suspended|banned
- userType: customer|traveler|both
- verificationLevel: unverified|verified|fully_verified
- search: john@example.com
- page: 1
- limit: 50
- sortBy: created_at|last_active|total_deliveries
- sortOrder: asc|desc
```

#### 6. Get User Details
```http
GET /api/v1/admin/users/:userId
Authorization: Bearer <admin_access_token>
```

#### 7. Update User Status
```http
PUT /api/v1/admin/users/:userId/status
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "status": "suspended",
  "reason": "Violation of terms of service",
  "suspensionDuration": 30, // days
  "notifyUser": true,
  "internalNotes": "Multiple customer complaints received"
}
```

#### 8. Verify User Identity
```http
POST /api/v1/admin/users/:userId/verify
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "verificationLevel": "fully_verified",
  "verifiedDocuments": ["passport", "selfie"],
  "verificationNotes": "All documents verified successfully",
  "verifiedBy": "admin-uuid"
}
```

### Financial Management Endpoints

#### 9. Get Financial Overview
```http
GET /api/v1/admin/finance/overview
Authorization: Bearer <admin_access_token>
Query Parameters:
- period: today|week|month|quarter|year
- currency: USD|EUR|GBP
```

#### 10. Get Transaction History
```http
GET /api/v1/admin/finance/transactions
Authorization: Bearer <admin_access_token>
Query Parameters:
- type: payment|payout|refund|fee
- status: pending|completed|failed
- amountMin: 1000 (in cents)
- amountMax: 100000
- startDate: 2025-01-01
- endDate: 2025-01-31
- userId: user-uuid
- page: 1
- limit: 100
```

#### 11. Process Manual Payout
```http
POST /api/v1/admin/finance/payouts/manual
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "userId": "user-uuid",
  "amount": 5000, // in cents
  "currency": "USD",
  "reason": "Manual adjustment for service issue",
  "reference": "MANUAL-001",
  "notifyUser": true
}
```

#### 12. Generate Financial Report
```http
POST /api/v1/admin/finance/reports/generate
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "reportType": "revenue|payouts|fees|taxes",
  "period": {
    "start": "2025-01-01",
    "end": "2025-01-31"
  },
  "format": "pdf|xlsx|csv",
  "includeDetails": true,
  "groupBy": "day|week|month",
  "currency": "USD"
}
```

### Dispute Management Endpoints

#### 13. Get Disputes
```http
GET /api/v1/admin/disputes
Authorization: Bearer <admin_access_token>
Query Parameters:
- status: open|under_review|resolved
- priority: low|medium|high|urgent
- category: item_not_delivered|payment_issue
- assignee: admin-uuid
- createdAfter: 2025-01-01
- page: 1
- limit: 50
```

#### 14. Get Dispute Details
```http
GET /api/v1/admin/disputes/:disputeId
Authorization: Bearer <admin_access_token>
```

#### 15. Assign Dispute
```http
POST /api/v1/admin/disputes/:disputeId/assign
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "assigneeId": "admin-uuid",
  "priority": "high",
  "dueDate": "2025-01-20T17:00:00Z",
  "notes": "High-value dispute, needs immediate attention"
}
```

#### 16. Resolve Dispute
```http
POST /api/v1/admin/disputes/:disputeId/resolve
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "resolution": "partial_refund",
  "refundAmount": 2500, // in cents
  "resolutionNotes": "Partial refund approved based on evidence provided",
  "notifyParties": true,
  "closeRelatedTickets": true
}
```

### System Management Endpoints

#### 17. Get System Configuration
```http
GET /api/v1/admin/system/config
Authorization: Bearer <admin_access_token>
Query Parameters:
- category: platform|payment|notification|security
```

#### 18. Update Configuration
```http
PUT /api/v1/admin/system/config
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "category": "platform",
  "key": "maintenance_mode",
  "value": false,
  "description": "Enable/disable maintenance mode"
}
```

#### 19. Create System Backup
```http
POST /api/v1/admin/system/backups
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "backupType": "full",
  "description": "Weekly full backup",
  "includeUploads": true,
  "includeLogs": false,
  "retentionDays": 30
}
```

#### 20. Export Data
```http
POST /api/v1/admin/data/export
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "exportType": "users",
  "format": "csv",
  "filters": {
    "status": "active",
    "createdAfter": "2025-01-01"
  },
  "fields": ["id", "email", "firstName", "lastName", "createdAt"],
  "notifyWhenComplete": true
}
```

## 🏗️ Service Architecture

### Directory Structure
```
admin-service/
├── src/
│   ├── controllers/
│   │   ├── dashboardController.js
│   │   ├── userManagementController.js
│   │   ├── financeController.js
│   │   ├── disputeController.js
│   │   ├── systemController.js
│   │   └── analyticsController.js
│   ├── models/
│   │   ├── AdminUser.js
│   │   ├── AdminActivityLog.js
│   │   ├── SystemConfiguration.js
│   │   ├── Dispute.js
│   │   ├── DisputeEvidence.js
│   │   └── DailyMetrics.js
│   ├── services/
│   │   ├── dashboardService.js
│   │   ├── userManagementService.js
│   │   ├── financeService.js
│   │   ├── disputeService.js
│   │   ├── analyticsService.js
│   │   ├── reportingService.js
│   │   ├── backupService.js
│   │   └── auditService.js
│   ├── middleware/
│   │   ├── adminAuthMiddleware.js
│   │   ├── permissionMiddleware.js
│   │   ├── auditMiddleware.js
│   │   └── rateLimitMiddleware.js
│   ├── routes/
│   │   ├── dashboardRoutes.js
│   │   ├── userRoutes.js
│   │   ├── financeRoutes.js
│   │   ├── disputeRoutes.js
│   │   └── systemRoutes.js
│   ├── utils/
│   │   ├── permissionUtils.js
│   │   ├── reportUtils.js
│   │   ├── exportUtils.js
│   │   └── validationUtils.js
│   ├── jobs/
│   │   ├── metricsAggregationJob.js
│   │   ├── reportGenerationJob.js
│   │   ├── backupJob.js
│   │   └── alertJob.js
│   ├── realtime/
│   │   ├── dashboardSocket.js
│   │   ├── alertSystem.js
│   │   └── notificationHub.js
│   ├── config/
│   │   ├── database.js
│   │   ├── permissions.js
│   │   ├── alerts.js
│   │   └── reports.js
│   └── app.js
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard/
│   │   │   ├── UserManagement/
│   │   │   ├── Finance/
│   │   │   ├── Disputes/
│   │   │   └── System/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── utils/
│   │   └── App.js
│   ├── public/
│   └── package.json
├── tests/
├── docker/
│   └── Dockerfile
├── package.json
└── README.md
```

### Core Components

#### 1. Dashboard Service
```javascript
class DashboardService {
  constructor() {
    this.metricsService = new MetricsService();
    this.alertService = new AlertService();
    this.cacheService = new CacheService();
  }

  async getDashboardOverview(period = 'week', timezone = 'UTC') {
    const cacheKey = `dashboard:overview:${period}:${timezone}`;
    const cached = await this.cacheService.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    const dateRange = this.getDateRange(period, timezone);
    
    // Get key metrics in parallel
    const [
      userMetrics,
      deliveryMetrics,
      financialMetrics,
      systemMetrics,
      alerts
    ] = await Promise.all([
      this.getUserMetrics(dateRange),
      this.getDeliveryMetrics(dateRange),
      this.getFinancialMetrics(dateRange),
      this.getSystemMetrics(dateRange),
      this.alertService.getActiveAlerts()
    ]);

    const overview = {
      period,
      timezone,
      dateRange,
      userMetrics,
      deliveryMetrics,
      financialMetrics,
      systemMetrics,
      alerts,
      lastUpdated: new Date()
    };

    // Cache for 5 minutes
    await this.cacheService.setex(cacheKey, 300, overview);
    
    return overview;
  }

  async getUserMetrics(dateRange) {
    const metrics = await this.metricsService.getUserMetrics(dateRange);
    
    return {
      totalUsers: metrics.totalUsers,
      newUsers: metrics.newUsers,
      activeUsers: metrics.activeUsers,
      verifiedUsers: metrics.verifiedUsers,
      suspendedUsers: metrics.suspendedUsers,
      userGrowthRate: this.calculateGrowthRate(metrics.newUsers, metrics.previousNewUsers),
      averageRating: metrics.averageRating,
      topCountries: metrics.topCountries
    };
  }

  async getDeliveryMetrics(dateRange) {
    const metrics = await this.metricsService.getDeliveryMetrics(dateRange);
    
    return {
      totalDeliveries: metrics.totalDeliveries,
      completedDeliveries: metrics.completedDeliveries,
      cancelledDeliveries: metrics.cancelledDeliveries,
      pendingDeliveries: metrics.pendingDeliveries,
      completionRate: (metrics.completedDeliveries / metrics.totalDeliveries) * 100,
      averageDeliveryTime: metrics.averageDeliveryTime,
      topRoutes: metrics.topRoutes,
      categoryBreakdown: metrics.categoryBreakdown
    };
  }

  async getFinancialMetrics(dateRange) {
    const metrics = await this.metricsService.getFinancialMetrics(dateRange);
    
    return {
      totalRevenue: metrics.totalRevenue,
      platformFees: metrics.platformFees,
      payouts: metrics.payouts,
      refunds: metrics.refunds,
      netRevenue: metrics.totalRevenue - metrics.payouts - metrics.refunds,
      averageOrderValue: metrics.averageOrderValue,
      revenueGrowthRate: this.calculateGrowthRate(metrics.totalRevenue, metrics.previousRevenue),
      topEarningRoutes: metrics.topEarningRoutes
    };
  }

  async getSystemMetrics(dateRange) {
    const metrics = await this.metricsService.getSystemMetrics(dateRange);
    
    return {
      apiCalls: metrics.apiCalls,
      averageResponseTime: metrics.averageResponseTime,
      errorRate: (metrics.errors / metrics.apiCalls) * 100,
      uptime: metrics.uptime,
      activeServices: metrics.activeServices,
      queueBacklog: metrics.queueBacklog,
      databasePerformance: metrics.databasePerformance
    };
  }

  calculateGrowthRate(current, previous) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }
}
```

#### 2. User Management Service
```javascript
class UserManagementService {
  async getUsers(filters = {}, pagination = {}) {
    const {
      status,
      userType,
      verificationLevel,
      search,
      country,
      registeredAfter,
      registeredBefore
    } = filters;

    const {
      page = 1,
      limit = 50,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = pagination;

    // Build query with filters
    const query = this.buildUserQuery(filters);
    
    // Execute query with pagination
    const users = await this.userRepository.findWithFilters(query, {
      page,
      limit,
      sortBy,
      sortOrder
    });

    // Enhance user data with statistics
    const enhancedUsers = await Promise.all(
      users.data.map(user => this.enhanceUserData(user))
    );

    return {
      users: enhancedUsers,
      pagination: {
        page,
        limit,
        total: users.total,
        totalPages: Math.ceil(users.total / limit)
      },
      filters
    };
  }

  async enhanceUserData(user) {
    // Get user statistics
    const stats = await this.userStatisticsRepository.findByUserId(user.id);
    
    // Get recent activity
    const recentActivity = await this.getRecentUserActivity(user.id);
    
    // Get verification status
    const verification = await this.userVerificationRepository.findByUserId(user.id);
    
    return {
      ...user,
      statistics: stats,
      recentActivity,
      verification: {
        level: user.verificationLevel,
        documents: verification?.documents || [],
        verifiedAt: verification?.verifiedAt,
        verifiedBy: verification?.verifiedBy
      }
    };
  }

  async updateUserStatus(userId, statusUpdate, adminId) {
    const { status, reason, suspensionDuration, notifyUser, internalNotes } = statusUpdate;
    
    // Validate status change
    await this.validateStatusChange(userId, status);
    
    // Update user status
    const updatedUser = await this.userRepository.update(userId, {
      status,
      suspendedUntil: suspensionDuration ? 
        moment().add(suspensionDuration, 'days').toDate() : null,
      updatedAt: new Date()
    });

    // Create admin activity log
    await this.auditService.logAdminActivity(adminId, 'user_status_update', 'user', userId, {
      oldStatus: updatedUser.previousStatus,
      newStatus: status,
      reason,
      suspensionDuration,
      internalNotes
    });

    // Send notification to user if requested
    if (notifyUser) {
      await this.notificationService.sendUserStatusNotification(userId, {
        status,
        reason,
        suspensionDuration
      });
    }

    // Handle side effects based on status
    await this.handleStatusChangeEffects(userId, status);

    return updatedUser;
  }

  async handleStatusChangeEffects(userId, status) {
    switch (status) {
      case 'suspended':
        // Cancel active deliveries
        await this.deliveryService.cancelUserActiveDeliveries(userId, 'user_suspended');
        
        // Revoke active sessions
        await this.authService.revokeUserSessions(userId);
        break;
        
      case 'banned':
        // More severe actions for banned users
        await this.deliveryService.cancelUserActiveDeliveries(userId, 'user_banned');
        await this.authService.revokeUserSessions(userId);
        await this.paymentService.holdUserPayouts(userId);
        break;
        
      case 'active':
        // Restore user privileges
        await this.paymentService.releaseUserPayouts(userId);
        break;
    }
  }
}
```

#### 3. Dispute Management Service
```javascript
class DisputeManagementService {
  async getDisputes(filters = {}, pagination = {}) {
    const {
      status,
      priority,
      category,
      assignee,
      createdAfter,
      createdBefore,
      amountMin,
      amountMax
    } = filters;

    const disputes = await this.disputeRepository.findWithFilters(filters, pagination);
    
    // Enhance dispute data
    const enhancedDisputes = await Promise.all(
      disputes.data.map(dispute => this.enhanceDisputeData(dispute))
    );

    return {
      disputes: enhancedDisputes,
      pagination: disputes.pagination,
      summary: await this.getDisputeSummary(filters)
    };
  }

  async enhanceDisputeData(dispute) {
    // Get related data
    const [delivery, evidence, messages, timeline] = await Promise.all([
      this.deliveryRepository.findById(dispute.deliveryId),
      this.disputeEvidenceRepository.findByDisputeId(dispute.id),
      this.disputeMessageRepository.findByDisputeId(dispute.id),
      this.getDisputeTimeline(dispute.id)
    ]);

    return {
      ...dispute,
      delivery,
      evidence,
      messages: messages.filter(m => !m.isInternal), // Hide internal notes
      internalNotes: messages.filter(m => m.isInternal),
      timeline
    };
  }

  async assignDispute(disputeId, assignmentData, adminId) {
    const { assigneeId, priority, dueDate, notes } = assignmentData;
    
    // Validate assignment
    await this.validateDisputeAssignment(disputeId, assigneeId);
    
    // Update dispute
    const updatedDispute = await this.disputeRepository.update(disputeId, {
      assigneeId,
      priority,
      dueDate,
      assignedAt: new Date(),
      status: 'under_review'
    });

    // Add assignment message
    await this.disputeMessageRepository.create({
      disputeId,
      senderId: adminId,
      message: `Dispute assigned to ${assigneeId}. Priority: ${priority}. ${notes || ''}`,
      isInternal: true
    });

    // Notify assignee
    await this.notificationService.sendDisputeAssignmentNotification(assigneeId, updatedDispute);
    
    // Log admin activity
    await this.auditService.logAdminActivity(adminId, 'dispute_assigned', 'dispute', disputeId, {
      assigneeId,
      priority,
      dueDate,
      notes
    });

    return updatedDispute;
  }

  async resolveDispute(disputeId, resolutionData, adminId) {
    const {
      resolution,
      refundAmount,
      resolutionNotes,
      notifyParties,
      closeRelatedTickets
    } = resolutionData;

    const dispute = await this.disputeRepository.findById(disputeId);
    
    if (!dispute) {
      throw new DisputeNotFoundError('Dispute not found');
    }

    // Process resolution based on type
    await this.processResolution(dispute, resolution, refundAmount);
    
    // Update dispute status
    const resolvedDispute = await this.disputeRepository.update(disputeId, {
      status: 'resolved',
      requestedResolution: resolution,
      resolutionNotes,
      resolvedAt: new Date()
    });

    // Add resolution message
    await this.disputeMessageRepository.create({
      disputeId,
      senderId: adminId,
      message: `Dispute resolved: ${resolution}. ${resolutionNotes}`,
      isInternal: false
    });

    // Notify parties if requested
    if (notifyParties) {
      await this.notifyDisputeParties(dispute, resolutionData);
    }

    // Close related tickets if requested
    if (closeRelatedTickets) {
      await this.closeRelatedTickets(dispute.deliveryId);
    }

    // Log resolution
    await this.auditService.logAdminActivity(adminId, 'dispute_resolved', 'dispute', disputeId, {
      resolution,
      refundAmount,
      resolutionNotes
    });

    return resolvedDispute;
  }

  async processResolution(dispute, resolution, refundAmount) {
    switch (resolution) {
      case 'full_refund':
        await this.paymentService.processRefund(dispute.paymentIntentId, {
          amount: dispute.amount,
          reason: 'dispute_resolution'
        });
        break;
        
      case 'partial_refund':
        await this.paymentService.processRefund(dispute.paymentIntentId, {
          amount: refundAmount,
          reason: 'dispute_resolution'
        });
        break;
        
      case 'replacement':
        // Handle replacement logic
        await this.deliveryService.createReplacementDelivery(dispute.deliveryId);
        break;
        
      case 'compensation':
        // Provide compensation to affected party
        await this.paymentService.processCompensation(dispute.complainantId, refundAmount);
        break;
        
      case 'no_action':
        // No financial action required
        break;
    }
  }
}
```

#### 4. Financial Management Service
```javascript
class FinancialManagementService {
  async getFinancialOverview(period, currency = 'USD') {
    const dateRange = this.getDateRange(period);
    
    // Get financial data in parallel
    const [
      revenue,
      payouts,
      refunds,
      fees,
      transactions,
      topPerformers
    ] = await Promise.all([
      this.getRevenueSummary(dateRange, currency),
      this.getPayoutSummary(dateRange, currency),
      this.getRefundSummary(dateRange, currency),
      this.getFeeSummary(dateRange, currency),
      this.getTransactionSummary(dateRange, currency),
      this.getTopPerformers(dateRange, currency)
    ]);

    return {
      period,
      currency,
      dateRange,
      summary: {
        totalRevenue: revenue.total,
        totalPayouts: payouts.total,
        totalRefunds: refunds.total,
        platformFees: fees.platform,
        processingFees: fees.processing,
        netRevenue: revenue.total - payouts.total - refunds.total
      },
      trends: {
        revenueGrowth: revenue.growth,
        payoutGrowth: payouts.growth,
        transactionVolume: transactions.volume
      },
      topPerformers,
      breakdown: {
        revenueByCategory: revenue.byCategory,
        revenueByCountry: revenue.byCountry,
        payoutsByUser: payouts.byUser
      }
    };
  }

  async processManualPayout(payoutData, adminId) {
    const {
      userId,
      amount,
      currency,
      reason,
      reference,
      notifyUser
    } = payoutData;

    // Validate payout request
    await this.validateManualPayout(userId, amount, currency);
    
    // Get user payout account
    const payoutAccount = await this.payoutAccountRepository.findByUserId(userId);
    
    if (!payoutAccount || payoutAccount.status !== 'active') {
      throw new PayoutAccountError('User does not have an active payout account');
    }

    // Process payout through payment service
    const payout = await this.paymentService.processManualPayout({
      userId,
      payoutAccountId: payoutAccount.id,
      amount,
      currency,
      description: `Manual payout: ${reason}`,
      reference,
      type: 'manual'
    });

    // Log admin activity
    await this.auditService.logAdminActivity(adminId, 'manual_payout', 'payout', payout.id, {
      userId,
      amount,
      currency,
      reason,
      reference
    });

    // Notify user if requested
    if (notifyUser) {
      await this.notificationService.sendManualPayoutNotification(userId, {
        amount,
        currency,
        reason,
        reference: payout.id
      });
    }

    return payout;
  }

  async generateFinancialReport(reportConfig, adminId) {
    const {
      reportType,
      period,
      format,
      includeDetails,
      groupBy,
      currency,
      filters
    } = reportConfig;

    // Create report generation job
    const job = await this.reportQueue.add('generate-financial-report', {
      reportType,
      period,
      format,
      includeDetails,
      groupBy,
      currency,
      filters,
      requestedBy: adminId
    });

    // Log report request
    await this.auditService.logAdminActivity(adminId, 'report_requested', 'report', job.id, {
      reportType,
      period,
      format
    });

    return {
      jobId: job.id,
      status: 'processing',
      estimatedCompletion: moment().add(5, 'minutes').toDate()
    };
  }
}
```

#### 5. Real-time Dashboard Socket
```javascript
class DashboardSocketService {
  constructor(io) {
    this.io = io;
    this.connectedAdmins = new Map();
    this.setupSocketHandlers();
    this.startMetricsStreaming();
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      socket.on('admin-join', async (data) => {
        const { adminId, permissions } = data;
        
        // Validate admin permissions
        const isValid = await this.validateAdminPermissions(adminId, permissions);
        
        if (isValid) {
          this.connectedAdmins.set(socket.id, { adminId, permissions });
          socket.join('admin-dashboard');
          
          // Send initial dashboard data
          const dashboardData = await this.dashboardService.getDashboardOverview();
          socket.emit('dashboard-data', dashboardData);
        } else {
          socket.emit('auth-error', { message: 'Insufficient permissions' });
          socket.disconnect();
        }
      });

      socket.on('subscribe-metrics', (metricTypes) => {
        metricTypes.forEach(type => {
          socket.join(`metrics-${type}`);
        });
      });

      socket.on('disconnect', () => {
        this.connectedAdmins.delete(socket.id);
      });
    });
  }

  startMetricsStreaming() {
    // Stream real-time metrics every 30 seconds
    setInterval(async () => {
      const realtimeMetrics = await this.metricsService.getRealtimeMetrics();
      this.io.to('admin-dashboard').emit('metrics-update', realtimeMetrics);
    }, 30000);

    // Stream alerts immediately
    this.alertService.on('new-alert', (alert) => {
      this.io.to('admin-dashboard').emit('new-alert', alert);
    });

    // Stream system events
    this.systemEventEmitter.on('system-event', (event) => {
      this.io.to('admin-dashboard').emit('system-event', event);
    });
  }

  broadcastToAdmins(event, data, requiredPermission = null) {
    this.connectedAdmins.forEach((admin, socketId) => {
      if (!requiredPermission || admin.permissions.includes(requiredPermission)) {
        this.io.to(socketId).emit(event, data);
      }
    });
  }
}
```

## 🔐 Security & Permissions

### 1. Role-based Access Control
```javascript
class PermissionService {
  constructor() {
    this.permissions = {
      super_admin: ['*'], // All permissions
      admin: [
        'users.read', 'users.write', 'users.suspend',
        'finance.read', 'finance.write', 'finance.payouts',
        'disputes.read', 'disputes.write', 'disputes.resolve',
        'system.read', 'system.write', 'system.config'
      ],
      moderator: [
        'users.read', 'users.suspend',
        'disputes.read', 'disputes.write',
        'content.moderate'
      ],
      support: [
        'users.read', 'disputes.read', 'disputes.write'
      ],
      finance: [
        'finance.read', 'finance.write', 'finance.payouts',
        'users.read'
      ],
      analyst: [
        'analytics.read', 'reports.generate',
        'users.read', 'finance.read'
      ]
    };
  }

  hasPermission(userRole, requiredPermission) {
    const userPermissions = this.permissions[userRole] || [];
    
    // Super admin has all permissions
    if (userPermissions.includes('*')) {
      return true;
    }
    
    return userPermissions.includes(requiredPermission);
  }

  checkMultiplePermissions(userRole, requiredPermissions) {
    return requiredPermissions.every(permission => 
      this.hasPermission(userRole, permission)
    );
  }
}

// Middleware for permission checking
const requirePermission = (permission) => {
  return async (req, res, next) => {
    const adminUser = req.adminUser;
    
    if (!adminUser) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }
    
    if (!permissionService.hasPermission(adminUser.role, permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};
```

### 2. Audit Trail System
```javascript
class AuditService {
  async logAdminActivity(adminId, action, resourceType, resourceId, details = {}) {
    const activityLog = {
      adminId,
      action,
      resourceType,
      resourceId,
      description: this.generateDescription(action, resourceType, details),
      details,
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
      createdAt: new Date()
    };

    await this.adminActivityLogRepository.create(activityLog);
    
    // Trigger real-time notification for sensitive actions
    if (this.isSensitiveAction(action)) {
      await this.notificationService.sendSensitiveActionAlert(adminId, activityLog);
    }
  }

  generateDescription(action, resourceType, details) {
    const descriptions = {
      'user_status_update': `Updated user status from ${details.oldStatus} to ${details.newStatus}`,
      'manual_payout': `Processed manual payout of ${details.amount} ${details.currency}`,
      'dispute_resolved': `Resolved dispute with ${details.resolution}`,
      'system_config_update': `Updated system configuration: ${details.key}`,
      'user_verification': `Updated user verification level to ${details.verificationLevel}`
    };

    return descriptions[action] || `Performed ${action} on ${resourceType}`;
  }

  isSensitiveAction(action) {
    const sensitiveActions = [
      'user_ban', 'manual_payout', 'system_config_update', 
      'dispute_resolved', 'data_export'
    ];
    
    return sensitiveActions.includes(action);
  }
}
```

## 📈 Performance Optimization

### 1. Database Indexing
```sql
-- Admin activity indexes
CREATE INDEX idx_admin_activity_admin_id ON admin_activity_log(admin_id, created_at);
CREATE INDEX idx_admin_activity_action ON admin_activity_log(action, created_at);
CREATE INDEX idx_admin_activity_resource ON admin_activity_log(resource_type, resource_id);

-- Dispute indexes
CREATE INDEX idx_disputes_status_priority ON disputes(status, priority, created_at);
CREATE INDEX idx_disputes_assignee ON disputes(assignee_id, status);
CREATE INDEX idx_disputes_case_number ON disputes(case_number);

-- Metrics indexes
CREATE INDEX idx_daily_metrics_date_type ON daily_metrics(date, metric_type);
CREATE INDEX idx_daily_metrics_date ON daily_metrics(date DESC);

-- System configuration indexes
CREATE INDEX idx_system_config_category ON system_configuration(category, key);
```

### 2. Caching Strategy
```javascript
class AdminCacheService {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
  }

  async cacheDashboardData(period, data) {
    const key = `admin:dashboard:${period}`;
    await this.redis.setex(key, 300, JSON.stringify(data)); // 5 min cache
  }

  async cacheUserList(filters, data) {
    const key = `admin:users:${this.hashFilters(filters)}`;
    await this.redis.setex(key, 180, JSON.stringify(data)); // 3 min cache
  }

  async cacheFinancialData(period, currency, data) {
    const key = `admin:finance:${period}:${currency}`;
    await this.redis.setex(key, 600, JSON.stringify(data)); // 10 min cache
  }

  async invalidateUserCache(userId) {
    const pattern = `admin:users:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

## 🧪 Testing Strategy

### 1. Permission Testing
```javascript
describe('Permission System', () => {
  describe('hasPermission', () => {
    it('should grant access to super_admin for all permissions', () => {
      expect(permissionService.hasPermission('super_admin', 'users.delete')).toBe(true);
      expect(permissionService.hasPermission('super_admin', 'system.config')).toBe(true);
    });

    it('should restrict moderator permissions correctly', () => {
      expect(permissionService.hasPermission('moderator', 'users.read')).toBe(true);
      expect(permissionService.hasPermission('moderator', 'finance.payouts')).toBe(false);
    });
  });
});
```

### 2. Dashboard Testing
```javascript
describe('Dashboard Service', () => {
  it('should return complete dashboard overview', async () => {
    const overview = await dashboardService.getDashboardOverview('week', 'UTC');
    
    expect(overview).toHaveProperty('userMetrics');
    expect(overview).toHaveProperty('deliveryMetrics');
    expect(overview).toHaveProperty('financialMetrics');
    expect(overview).toHaveProperty('systemMetrics');
    expect(overview.userMetrics.totalUsers).toBeGreaterThan(0);
  });
});
```

## 📊 Performance Benchmarks

### Expected Performance Metrics
- **Dashboard Load**: < 500ms average response time
- **User List**: < 300ms average response time
- **Financial Reports**: < 2s for standard reports
- **Real-time Updates**: < 100ms latency
- **Data Export**: < 30s for 100K records
- **Throughput**: 200+ concurrent admin users

This Admin Service architecture provides comprehensive administrative capabilities with robust security, real-time monitoring, and scalable performance for the P2P Delivery Platform.