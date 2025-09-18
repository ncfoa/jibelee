const { sequelize } = require('../config/database');
const User = require('./User');
const UserSession = require('./UserSession');
const UserTwoFactorAuth = require('./UserTwoFactorAuth');
const PasswordResetToken = require('./PasswordResetToken');
const EmailVerificationToken = require('./EmailVerificationToken');

// Define associations
User.hasMany(UserSession, {
  foreignKey: 'userId',
  as: 'sessions',
  onDelete: 'CASCADE'
});

UserSession.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

User.hasOne(UserTwoFactorAuth, {
  foreignKey: 'userId',
  as: 'twoFactorAuth',
  onDelete: 'CASCADE'
});

UserTwoFactorAuth.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

User.hasMany(PasswordResetToken, {
  foreignKey: 'userId',
  as: 'passwordResetTokens',
  onDelete: 'CASCADE'
});

PasswordResetToken.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

User.hasMany(EmailVerificationToken, {
  foreignKey: 'userId',
  as: 'emailVerificationTokens',
  onDelete: 'CASCADE'
});

EmailVerificationToken.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// Self-referencing association for referrals
User.hasMany(User, {
  foreignKey: 'referredByUserId',
  as: 'referredUsers'
});

User.belongsTo(User, {
  foreignKey: 'referredByUserId',
  as: 'referredBy'
});

// Sync database
const syncDatabase = async (force = false) => {
  try {
    await sequelize.sync({ force });
    console.log('Database synchronized successfully');
  } catch (error) {
    console.error('Error synchronizing database:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  User,
  UserSession,
  UserTwoFactorAuth,
  PasswordResetToken,
  EmailVerificationToken,
  syncDatabase
};