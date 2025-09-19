# Payment Service

A comprehensive payment and pricing microservice for the P2P Delivery Platform, featuring dynamic pricing, escrow management, fraud detection, and multi-currency support.

## 🚀 Features

### Core Payment Features
- **Dynamic Pricing Engine** - AI-driven pricing based on 15+ market factors
- **Payment Processing** - Secure payment handling with Stripe integration
- **Escrow Management** - Secure fund holding until delivery completion
- **Fraud Detection** - Advanced ML-based fraud prevention
- **Multi-currency Support** - Global currency handling with real-time conversion
- **Instant Payouts** - Same-day payouts for verified travelers

### Advanced Features
- **Market Analysis** - Real-time market conditions and competitor analysis
- **Demand Forecasting** - Predictive analytics for pricing optimization
- **Subscription Management** - Premium feature subscriptions
- **Dispute Resolution** - Automated and manual dispute handling
- **Tax Compliance** - Automated tax document generation
- **Comprehensive Analytics** - Financial reporting and business intelligence

## 🏗️ Architecture

The service follows a microservices architecture with:
- **Node.js/Express** - RESTful API server
- **PostgreSQL** - Primary database with Sequelize ORM
- **Redis** - Caching and session management
- **Stripe** - Payment processing and Connect accounts
- **Bull Queue** - Background job processing
- **Winston** - Structured logging

## 📦 Installation

### Prerequisites
- Node.js >= 18.0.0
- PostgreSQL >= 13
- Redis >= 6.0
- Stripe Account

### Setup

1. **Clone and install dependencies:**
```bash
cd payment-service
npm install
```

2. **Environment Configuration:**
```bash
cp .env.example .env
```

Configure the following environment variables:
```env
# Server
NODE_ENV=development
PORT=3007
LOG_LEVEL=info

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=payment_db
DB_USERNAME=postgres
DB_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Stripe
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret

# Security
JWT_SECRET=your_jwt_secret
SERVICE_TOKEN=your_service_token
VALID_API_KEYS=key1,key2,key3

# External Services
NOTIFICATION_SERVICE_URL=http://notification-service:3009

# Features
PLATFORM_FEE_RATE=0.10
BASE_FEE=15.00
DISTANCE_RATE=0.05
WEIGHT_RATE=5.00
```

3. **Database Setup:**
```bash
# Create database
createdb payment_db

# Run migrations (when available)
npm run migrate

# Seed initial data (when available)
npm run seed
```

4. **Start the service:**
```bash
# Development
npm run dev

# Production
npm start
```

## 🔧 API Documentation

### Base URL
```
http://localhost:3007/api/v1/payments
```

### Authentication
All endpoints require authentication via JWT token:
```
Authorization: Bearer <access_token>
```

### Key Endpoints

#### Pricing
- `POST /calculate-price` - Calculate delivery price
- `GET /market-analysis` - Get market analysis
- `POST /optimize-pricing` - Optimize pricing strategy
- `GET /exchange-rates` - Get currency exchange rates

#### Payments
- `POST /intents` - Create payment intent
- `POST /intents/:id/confirm` - Confirm payment
- `GET /intents/:id` - Get payment status
- `GET /history` - Get payment history

#### Escrow
- `POST /escrow/:id/release` - Release escrow funds
- `GET /escrow/:id` - Get escrow status
- `POST /escrow/:id/dispute` - Dispute escrow

#### Payouts
- `POST /payout-accounts` - Create payout account
- `GET /payout-accounts/me` - Get account status
- `POST /instant-payout` - Request instant payout
- `GET /payouts/history` - Get payout history

#### Analytics
- `GET /analytics` - Financial analytics
- `GET /earnings` - Earnings summary
- `GET /reports/financial` - Financial reports

### Example Requests

#### Calculate Price
```bash
curl -X POST http://localhost:3007/api/v1/payments/calculate-price \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "deliveryRequest": {
      "route": {
        "origin": {"lat": 40.7128, "lng": -74.0060, "address": "New York, NY"},
        "destination": {"lat": 42.3601, "lng": -71.0589, "address": "Boston, MA"}
      },
      "item": {
        "weight": 2.5,
        "dimensions": {"length": 30, "width": 20, "height": 10},
        "value": 500.00,
        "category": "electronics",
        "fragile": true
      },
      "urgency": "express"
    }
  }'
```

#### Create Payment
```bash
curl -X POST http://localhost:3007/api/v1/payments/intents \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "deliveryId": "delivery-uuid",
    "amount": 6523,
    "currency": "USD",
    "customerId": "customer-uuid",
    "paymentMethodId": "pm_1234567890"
  }'
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- --testPathPattern=payment.test.js
```

## 📊 Monitoring

### Health Checks
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed system health

### Logging
Structured JSON logs with Winston:
- Application logs: `logs/payment-service-combined-YYYY-MM-DD.log`
- Error logs: `logs/payment-service-error-YYYY-MM-DD.log`

### Metrics
Key metrics tracked:
- Payment success/failure rates
- Fraud detection accuracy
- Pricing calculation performance
- API response times
- Queue processing times

## 🔒 Security

### Features
- **Rate Limiting** - Configurable rate limits per endpoint
- **Input Validation** - Comprehensive request validation with Joi
- **Fraud Detection** - ML-based risk scoring
- **Encryption** - Data encryption at rest and in transit
- **Audit Logging** - Complete audit trail for compliance

### Best Practices
- JWT token validation
- Role-based access control
- Input sanitization
- SQL injection prevention
- XSS protection
- CORS configuration

## 🚀 Deployment

### Docker
```bash
# Build image
npm run docker:build

# Run with docker-compose
npm run docker:run
```

### Environment-specific Configurations
- **Development** - Enhanced logging, debug features
- **Staging** - Production-like with test data
- **Production** - Optimized performance, security hardened

## 📈 Performance

### Optimization Features
- **Redis Caching** - Multi-layer caching strategy
- **Connection Pooling** - Database connection optimization
- **Compression** - Response compression
- **Lazy Loading** - Efficient data loading

### Expected Performance
- **Price Calculation**: < 300ms average
- **Payment Processing**: < 2s average
- **Throughput**: 500+ transactions/second per instance

## 🤝 Contributing

1. Follow the existing code structure
2. Add comprehensive tests for new features
3. Update documentation
4. Follow security best practices
5. Use structured logging

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Check the API documentation
- Review the logs for error details
- Contact the development team

---

**Version**: 1.0.0  
**Last Updated**: 2025-01-XX  
**Maintainer**: P2P Delivery Platform Team