const { Sequelize } = require('sequelize');
const { sequelize } = require('../config/database');

// Import all models
const PaymentIntent = require('./PaymentIntent');
const EscrowAccount = require('./EscrowAccount');
const PayoutAccount = require('./PayoutAccount');
const Payout = require('./Payout');
const Refund = require('./Refund');
const Subscription = require('./Subscription');
const PricingFactor = require('./PricingFactor');
const TransactionLog = require('./TransactionLog');
const FraudAnalysis = require('./FraudAnalysis');
const CurrencyExchange = require('./CurrencyExchange');
const PaymentAnalytics = require('./PaymentAnalytics');

// Initialize models
const models = {
  PaymentIntent: PaymentIntent(sequelize, Sequelize.DataTypes),
  EscrowAccount: EscrowAccount(sequelize, Sequelize.DataTypes),
  PayoutAccount: PayoutAccount(sequelize, Sequelize.DataTypes),
  Payout: Payout(sequelize, Sequelize.DataTypes),
  Refund: Refund(sequelize, Sequelize.DataTypes),
  Subscription: Subscription(sequelize, Sequelize.DataTypes),
  PricingFactor: PricingFactor(sequelize, Sequelize.DataTypes),
  TransactionLog: TransactionLog(sequelize, Sequelize.DataTypes),
  FraudAnalysis: FraudAnalysis(sequelize, Sequelize.DataTypes),
  CurrencyExchange: CurrencyExchange(sequelize, Sequelize.DataTypes),
  PaymentAnalytics: PaymentAnalytics(sequelize, Sequelize.DataTypes)
};

// Define associations
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

models.sequelize = sequelize;
models.Sequelize = Sequelize;

module.exports = models;