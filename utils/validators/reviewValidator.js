const { check } = require('express-validator');
const validatorMiddleware = require('../../middlewares/validatorMiddleware');

exports.getReviewValidator = [
  check('id').isMongoId().withMessage('Invalid review id format'),
  validatorMiddleware,
];

exports.createReviewValidator = [
  check('rating')
    .notEmpty()
    .withMessage('Rating is required')
    .isFloat({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
    
  check('title')
    .optional()
    .isLength({ min: 3, max: 100 })
    .withMessage('Review title must be between 3 and 100 characters'),
    
  check('comment')
    .optional()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Comment must be between 10 and 1000 characters'),
    
  validatorMiddleware,
];

exports.updateReviewValidator = [
  check('id').isMongoId().withMessage('Invalid review id format'),
  
  check('rating')
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
    
  check('title')
    .optional()
    .isLength({ min: 3, max: 100 })
    .withMessage('Review title must be between 3 and 100 characters'),
    
  check('comment')
    .optional()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Comment must be between 10 and 1000 characters'),
    
  validatorMiddleware,
];

exports.deleteReviewValidator = [
  check('id').isMongoId().withMessage('Invalid review id format'),
  validatorMiddleware,
];