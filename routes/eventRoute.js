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
  getMyEvents,
  getPopularEvents
} = require('../services/eventService');

const authService = require('../services/authService');

const ticketRoute = require('./ticketRoute');
const reviewRoute = require('./reviewRoute');

const router = express.Router();

router.use('/:eventId/tickets', ticketRoute);
router.use('/:eventId/reviews', reviewRoute);

router.get('/', authService.protect, getEvents);
router.get('/popular', getPopularEvents);

router.use(authService.protect);
router.get('/organizer/my-events', authService.allowedTo('admin', 'manager'), getMyEvents);
router.get('/:id', getEventValidator, getEvent);
router.use(authService.allowedTo('admin', 'manager'));
router.post('/', createEventValidator, createEvent);
router.put('/:id', updateEventValidator, updateEvent);
router.delete('/:id', deleteEventValidator, deleteEvent);

module.exports = router;