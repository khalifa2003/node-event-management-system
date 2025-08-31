const { check, body } = require('express-validator');
const validatorMiddleware = require('../../middlewares/validatorMiddleware');

exports.getEventValidator = [
  check('id')
    .custom((val) => {
      // Allow both ObjectId and slug
      if (!val.match(/^[0-9a-fA-F]{24}$/) && !val.match(/^[a-z0-9-]+$/)) {
        throw new Error('Invalid event id or slug format');
      }
      return true;
    }),
  validatorMiddleware,
];

exports.createEventValidator = [
  check('title')
    .notEmpty()
    .withMessage('Event title is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters'),
    
  check('description')
    .notEmpty()
    .withMessage('Event description is required')
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters'),
    
  check('shortDescription')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Short description cannot exceed 200 characters'),
    
  check('category')
    .notEmpty()
    .withMessage('Event category is required')
    .isMongoId()
    .withMessage('Invalid category id'),
    
  check('venue.name')
    .notEmpty()
    .withMessage('Venue name is required'),
    
  check('venue.address')
    .notEmpty()
    .withMessage('Venue address is required'),
    
  check('venue.city')
    .notEmpty()
    .withMessage('Venue city is required'),
    
  check('dateTime.start')
    .notEmpty()
    .withMessage('Event start date is required')
    .isISO8601()
    .withMessage('Invalid start date format')
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('Start date must be in the future');
      }
      return true;
    }),
    
  check('dateTime.end')
    .notEmpty()
    .withMessage('Event end date is required')
    .isISO8601()
    .withMessage('Invalid end date format'),
    
  body('dateTime')
    .custom((value) => {
      if (new Date(value.end) <= new Date(value.start)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
    
  check('pricing.ticketPrice')
    .notEmpty()
    .withMessage('Ticket price is required')
    .isFloat({ min: 0 })
    .withMessage('Ticket price must be a positive number'),
    
  check('capacity.totalSeats')
    .notEmpty()
    .withMessage('Total seats is required')
    .isInt({ min: 1 })
    .withMessage('Total seats must be at least 1'),
    
  check('ageRestriction.minAge')
    .optional()
    .isInt({ min: 0, max: 120 })
    .withMessage('Minimum age must be between 0 and 120'),
    
  check('ageRestriction.maxAge')
    .optional()
    .isInt({ min: 0, max: 120 })
    .withMessage('Maximum age must be between 0 and 120'),
    
  validatorMiddleware,
];

exports.updateEventValidator = [
  check('id').isMongoId().withMessage('Invalid event id format'),
  
  check('title')
    .optional()
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters'),
    
  check('description')
    .optional()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters'),
    
  check('category')
    .optional()
    .isMongoId()
    .withMessage('Invalid category id'),
    
  check('dateTime.start')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),
    
  check('dateTime.end')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format'),
    
  check('pricing.ticketPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Ticket price must be a positive number'),
    
  check('capacity.totalSeats')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Total seats must be at least 1'),
    
  validatorMiddleware,
];

exports.deleteEventValidator = [
  check('id').isMongoId().withMessage('Invalid event id format'),
  validatorMiddleware,
];