const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const userModel = require('../models/user.model');

const getStorageUsage = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.userId);
  if (!user) throw new ApiError(404, 'User not found');

  res.json({
    success: true,
    storageUsed: Number(user.storage_used),
    storageLimit: Number(user.storage_limit),
    storageRemaining: Number(user.storage_limit) - Number(user.storage_used),
    percentUsed: Number(
      ((Number(user.storage_used) / Number(user.storage_limit)) * 100).toFixed(2)
    ),
  });
});

module.exports = { getStorageUsage };
