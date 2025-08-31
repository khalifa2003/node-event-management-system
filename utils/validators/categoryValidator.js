const { check, body } = require('express-validator');
const validatorMiddleware = require('../../middlewares/validatorMiddleware');

exports.getCategoryValidator = [
  check('id').isMongoId().withMessage('Invalid category id format'),
  validatorMiddleware,
];

exports.createCategoryValidator = [
  check('name')
    .notEmpty()
    .withMessage('Category name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Category name must be between 2 and 50 characters'),
  
  check('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
    
  check('color')
    .optional()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .withMessage('Color must be a valid hex color'),
    
  validatorMiddleware,
];

exports.updateCategoryValidator = [
  check('id').isMongoId().withMessage('Invalid category id format'),
  
  body('name')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Category name must be between 2 and 50 characters'),
    
  check('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
    
  check('color')
    .optional()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .withMessage('Color must be a valid hex color'),
    
  validatorMiddleware,
];

exports.deleteCategoryValidator = [
  check('id').isMongoId().withMessage('Invalid category id format'),
  validatorMiddleware,
];