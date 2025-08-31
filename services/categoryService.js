const asyncHandler = require('express-async-handler');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

const factory = require('./handlersFactory');
const ApiError = require('../utils/apiError');
const { uploadSingleImage } = require('../middlewares/uploadImageMiddleware');
const Category = require('../models/categoryModel');

exports.uploadCategoryImage = uploadSingleImage('image');

exports.resizeImage = asyncHandler(async (req, res, next) => {
  if (req.file) {
    const filename = `category-${uuidv4()}-${Date.now()}.jpeg`;
    await sharp(req.file.buffer)
      .resize(400, 400)
      .toFormat('jpeg')
      .jpeg({ quality: 90 })
      .toFile(`uploads/categories/${filename}`);
    req.body.image = filename;
  }
  next();
});

// Get all categories
// GET /api/v1/categories
// Public
exports.getCategories = factory.getAll(Category);

// Get specific category by id
// GET /api/v1/categories/:id
// Public
exports.getCategory = factory.getOne(Category, 'eventsCount');

// Create category
// POST /api/v1/categories
// Private/Admin
exports.createCategory = factory.createOne(Category);

// Update specific category
// PUT /api/v1/categories/:id
// Private/Admin
exports.updateCategory = factory.updateOne(Category);

// Delete specific category
// DELETE /api/v1/categories/:id
// Private/Admin
exports.deleteCategory = factory.deleteOne(Category);

// Get category statistics
// GET /api/v1/categories/stats
// Private/Admin
exports.getCategoryStats = asyncHandler(async (req, res, next) => {
  const stats = await Category.aggregate([
    {
      $lookup: {
        from: 'events',
        localField: '_id',
        foreignField: 'category',
        as: 'events'
      }
    },
    {
      $project: {
        name: 1,
        eventsCount: { $size: '$events' },
        activeEventsCount: {
          $size: {
            $filter: {
              input: '$events',
              cond: { $eq: ['$$this.status', 'published'] }
            }
          }
        },
        totalRevenue: {
          $sum: {
            $map: {
              input: '$events',
              as: 'event',
              in: {
                $multiply: ['$$event.capacity.soldSeats', '$$event.pricing.ticketPrice']
              }
            }
          }
        }
      }
    },
    {
      $sort: { eventsCount: -1 }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: stats
  });
});