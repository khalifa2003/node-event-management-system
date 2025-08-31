const express = require('express');
const {
  getTicketValidator,
  bookTicketValidator,
  checkInTicketValidator
} = require('../utils/validators/ticketValidator');

const {
  getAllTickets,
  getMyTickets,
  getTicket,
  bookTicket,
  cancelTicket,
  checkInTicket,
  getEventTickets
} = require('../services/ticketService');

const authService = require('../services/authService');

const router = express.Router({ mergeParams: true });

// All routes require authentication
router.use(authService.protect);

// User routes
router.get('/my-tickets', getMyTickets);
router.post('/book', bookTicketValidator, bookTicket);
router.patch('/:id/cancel', cancelTicket);

// Get specific ticket
router.get('/:id', getTicketValidator, getTicket);

// Admin/Manager routes
router.get('/', authService.allowedTo('admin', 'manager'), getAllTickets);
router.get('/event/:eventId', authService.allowedTo('admin', 'manager'), getEventTickets);
router.post('/checkin', authService.allowedTo('admin', 'manager'), checkInTicketValidator, checkInTicket);

module.exports = router;