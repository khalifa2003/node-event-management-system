const asyncHandler = require('express-async-handler');
const factory = require('./handlersFactory');
const Review = require('../models/reviewModel');
const ApiError = require('../utils/apiError');

// Nested route
// GET /api/v1/events/:eventId/reviews
exports.createFilterObj = (req, res, next) => {
  let filterObject = {};
  if (req.params.eventId) filterObject = { event: req.params.eventId };
  req.filterObj = filterObject;
  next();
};

// Nested route
// POST /api/v1/events/:eventId/reviews
exports.setEventUserIds = (req, res, next) => {
  if (!req.body.event) req.body.event = req.params.eventId;
  if (!req.body.user) req.body.user = req.user._id;
  next();
};

// Get list of reviews
// GET /api/v1/reviews
// GET /api/v1/events/:eventId/reviews
// Public
exports.getReviews = factory.getAll(Review);

// Get specific review by id
// GET /api/v1/reviews/:id
// Public
exports.getReview = factory.getOne(Review);

// Create review
// POST /api/v1/reviews
// POST /api/v1/events/:eventId/reviews
// Private/User
exports.createReview = asyncHandler(async (req, res, next) => {
  // Check if user already reviewed this event
  const existingReview = await Review.findOne({
    event: req.body.event,
    user: req.body.user
  });

  if (existingReview) {
    return next(new ApiError('You already reviewed this event', 400));
  }

  const review = await Review.create(req.body);
  res.status(201).json({ data: review });
});

// Update specific review
// PUT /api/v1/reviews/:id
// Private/User
exports.updateReview = asyncHandler(async (req, res, next) => {
  const review = await Review.findById(req.params.id);
  if (!review) {
    return next(new ApiError(`No review found for this id ${req.params.id}`, 404));
  }

  // Check review ownership
  if (review.user.toString() !== req.user._id.toString()) {
    return next(new ApiError('You can only update your own reviews', 403));
  }

  const updatedReview = await Review.findByIdAndUpdate(req.params.id, req.body, {
    new: true
  });

  res.status(200).json({ data: updatedReview });
});

// Delete specific review
// DELETE /api/v1/reviews/:id
// Private/User-Admin
exports.deleteReview = asyncHandler(async (req, res, next) => {
  const review = await Review.findById(req.params.id);
  if (!review) {
    return next(new ApiError(`No review found for this id ${req.params.id}`, 404));
  }

  // Check review ownership (user can delete own review, admin can delete any)
  if (review.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new ApiError('You can only delete your own reviews', 403));
  }

  await Review.findByIdAndDelete(req.params.id);
  res.status(204).send();
});