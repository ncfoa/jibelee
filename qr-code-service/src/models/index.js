const { sequelize } = require('../config/database');
const QRCode = require('./QRCode');
const QRCodeScan = require('./QRCodeScan');
const EmergencyOverride = require('./EmergencyOverride');

// Define associations
QRCode.hasMany(QRCodeScan, {
  foreignKey: 'qrCodeId',
  as: 'scans'
});

QRCodeScan.belongsTo(QRCode, {
  foreignKey: 'qrCodeId',
  as: 'qrCode'
});

QRCode.hasMany(EmergencyOverride, {
  foreignKey: 'qrCodeId',
  as: 'emergencyOverrides'
});

EmergencyOverride.belongsTo(QRCode, {
  foreignKey: 'qrCodeId',
  as: 'qrCode'
});

// Sync models with database
const syncDatabase = async (options = {}) => {
  try {
    await sequelize.sync(options);
    console.log('Database models synchronized successfully');
  } catch (error) {
    console.error('Error synchronizing database models:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  QRCode,
  QRCodeScan,
  EmergencyOverride,
  syncDatabase
};