const express = require('express');
const requireAuth = require('../middleware/auth.middleware');
const { getStorageUsage } = require('../controllers/user.controller');

const router = express.Router();

router.use(requireAuth);
router.get('/storage-usage', getStorageUsage);

module.exports = router;
