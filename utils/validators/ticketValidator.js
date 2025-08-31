const { check, body } = require('express-validator');
const validatorMiddleware = require('../../middlewares/validatorMiddleware');

exports.getTicketValidator = [
  check('id').isMongoId().withMessage('Invalid ticket id format'),
  validatorMiddleware,
];

exports.bookTicketValidator = [
  check('eventId')
    .notEmpty()
    .withMessage('Event ID is required')
    .isMongoId()
    .withMessage('Invalid event id format'),
    
  check('seatNumber')
    .notEmpty()
    .withMessage('Seat number is required')
    .isLength({ min: 1, max: 10 })
    .withMessage('Seat number must be between 1 and 10 characters'),
    
  check('paymentMethod')
    .notEmpty()
    .withMessage('Payment method is required')
    .isIn(['cash', 'card', 'online', 'bank_transfer'])
    .withMessage('Invalid payment method'),
    
  check('attendeeInfo.name')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Attendee name must be between 2 and 50 characters'),
    
  check('attendeeInfo.email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format'),
    
  check('attendeeInfo.phone')
    .optional()
    .isMobilePhone()
    .withMessage('Invalid phone number'),
    
  check('attendeeInfo.age')
    .optional()
    .isInt({ min: 1, max: 120 })
    .withMessage('Age must be between 1 and 120'),
    
  check('attendeeInfo.gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Invalid gender'),
    
  validatorMiddleware,
];

exports.checkInTicketValidator = [
  check('qrData')
    .notEmpty()
    .withMessage('QR data is required')
    .custom((value) => {
      try {
        const parsed = JSON.parse(value);
        if (!parsed.ticketId || !parsed.eventId || !parsed.ticketNumber) {
          throw new Error('Invalid QR data format');
        }
        return true;
      } catch (error) {
        throw new Error('Invalid QR data format');
      }
    }),
    
  check('gate')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Gate name cannot exceed 50 characters'),
    
  validatorMiddleware,
];