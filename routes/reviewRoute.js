const express = require('express');
const {
  getReviewValidator,
  createReviewValidator,
  updateReviewValidator,
  deleteReviewValidator
} = require('../utils/validators/reviewValidator');

const {
  getReviews,
  getReview,
  createReview,
  updateReview,
  deleteReview,
  setEventUserIds,
  createFilterObj
} = require('../services/reviewService');

const authService = require('../services/authService');

const router = express.Router({ mergeParams: true });

// Public routes
router.get('/', createFilterObj, getReviews);
router.get('/:id', getReviewValidator, getReview);

// Protected routes
router.use(authService.protect);

router.post('/', setEventUserIds, createReviewValidator, createReview);
router.put('/:id', updateReviewValidator, updateReview);
router.delete('/:id', authService.allowedTo('admin','user'), deleteReviewValidator, deleteReview);

module.exports = router;