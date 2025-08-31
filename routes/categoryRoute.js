const express = require('express');
const {
  getCategoryValidator,
  createCategoryValidator,
  updateCategoryValidator,
  deleteCategoryValidator
} = require('../utils/validators/categoryValidator');

const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  uploadCategoryImage,
  resizeImage,
  getCategoryStats
} = require('../services/categoryService');

const authService = require('../services/authService');

const router = express.Router();

// Public routes
router.get('/', getCategories);
router.get('/stats', authService.protect, authService.allowedTo('admin', 'manager'), getCategoryStats);
router.get('/:id', getCategoryValidator, getCategory);

// Protected routes - Admin/Manager only
router.use(authService.protect);
router.use(authService.allowedTo('admin', 'manager'));

router.post('/', uploadCategoryImage, resizeImage, createCategoryValidator, createCategory);
router.put('/:id', uploadCategoryImage, resizeImage, updateCategoryValidator, updateCategory);
router.delete('/:id', deleteCategoryValidator, deleteCategory);

module.exports = router;