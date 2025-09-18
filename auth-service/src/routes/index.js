const express = require('express');
const authRoutes = require('./authRoutes');
const twoFactorRoutes = require('./twoFactorRoutes');
const sessionRoutes = require('./sessionRoutes');
const socialRoutes = require('./socialRoutes');
const accountRoutes = require('./accountRoutes');

const router = express.Router();

// Mount route modules
router.use('/auth', authRoutes);
router.use('/auth/2fa', twoFactorRoutes);
router.use('/auth/sessions', sessionRoutes);
router.use('/auth/social', socialRoutes);
router.use('/auth/account', accountRoutes);

module.exports = router;