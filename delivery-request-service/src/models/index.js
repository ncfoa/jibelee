const { sequelize } = require('../config/database');
const DeliveryRequest = require('./DeliveryRequest');
const DeliveryOffer = require('./DeliveryOffer');
const Delivery = require('./Delivery');

// Define associations
DeliveryRequest.hasMany(DeliveryOffer, {
  foreignKey: 'delivery_request_id',
  as: 'offers'
});

DeliveryOffer.belongsTo(DeliveryRequest, {
  foreignKey: 'delivery_request_id',
  as: 'deliveryRequest'
});

DeliveryRequest.hasOne(Delivery, {
  foreignKey: 'delivery_request_id',
  as: 'delivery'
});

Delivery.belongsTo(DeliveryRequest, {
  foreignKey: 'delivery_request_id',
  as: 'deliveryRequest'
});

DeliveryOffer.hasOne(Delivery, {
  foreignKey: 'offer_id',
  as: 'delivery'
});

Delivery.belongsTo(DeliveryOffer, {
  foreignKey: 'offer_id',
  as: 'offer'
});

// Sync database (in development)
const syncDatabase = async () => {
  try {
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      console.log('Database synchronized successfully');
    }
  } catch (error) {
    console.error('Database synchronization failed:', error);
  }
};

module.exports = {
  sequelize,
  DeliveryRequest,
  DeliveryOffer,
  Delivery,
  syncDatabase
};