const express = require('express');
const profileRoutes = require('./profileRoutes');
const addressRoutes = require('./addressRoutes');
const verificationRoutes = require('./verificationRoutes');
const preferencesRoutes = require('./preferencesRoutes');
const reviewRoutes = require('./reviewRoutes');
const relationshipRoutes = require('./relationshipRoutes');

const router = express.Router();

// Mount route modules
router.use('/users', profileRoutes);
router.use('/users', addressRoutes);
router.use('/users', verificationRoutes);
router.use('/users', preferencesRoutes);
router.use('/users', reviewRoutes);
router.use('/users', relationshipRoutes);

module.exports = router;