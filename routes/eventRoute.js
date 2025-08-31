const express = require('express');
const {
  getEventValidator,
  createEventValidator,
  updateEventValidator,
  deleteEventValidator
} = require('../utils/validators/eventValidator');

const {
  getEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  uploadEventImages,
  resizeEventImages,
  getMyEvents,
  getPopularEvents
} = require('../services/eventService');

const authService = require('../services/authService');

// Import nested routes
const ticketRoute = require('./ticketRoute');
const reviewRoute = require('./reviewRoute');

const router = express.Router();

// Nested routes
router.use('/:eventId/tickets', ticketRoute);
router.use('/:eventId/reviews', reviewRoute);

// Public routes
router.get('/', getEvents);
router.get('/popular', getPopularEvents);

router.use(authService.protect);
router.get('/organizer/my-events', authService.allowedTo('admin', 'manager'), getMyEvents);
router.get('/:id', getEventValidator, getEvent);
router.use(authService.allowedTo('admin', 'manager'));
router.post('/', uploadEventImages, resizeEventImages, createEventValidator, createEvent);
router.put('/:id', uploadEventImages, resizeEventImages, updateEventValidator, updateEvent);
router.delete('/:id', deleteEventValidator, deleteEvent);

module.exports = router;