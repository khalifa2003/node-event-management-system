const { Types } = require('mongoose');
const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/apiError');
const Event = require('../models/eventModel');
const Ticket = require('../models/ticketModel');
const { generateQRCode } = require('./qrCodeService');

// Get all tickets (Admin only)
// GET /api/v1/tickets
// Private/Admin
exports.getAllTickets = asyncHandler(async (req, res, next) => {
  let filter = {};
  
  // Filter by event
  if (req.query.event) {
    filter.event = req.query.event;
  }
  
  // Filter by status
  if (req.query.status) {
    filter.status = req.query.status;
  }
  
  // Filter by payment status
  if (req.query.paymentStatus) {
    filter['payment.paymentStatus'] = req.query.paymentStatus;
  }
  
  const tickets = await Ticket.find(filter)
    .populate('event', 'title dateTime venue coverImage')
    .populate('user', 'name email phone')
    .sort('-createdAt');
    
  res.status(200).json({
    status: 'success',
    results: tickets.length,
    data: tickets
  });
});

// Get user's tickets
// GET /api/v1/tickets/my-tickets
// Private/User
exports.getMyTickets = asyncHandler(async (req, res, next) => {
  let filter = { user: req.user._id };
  
  if (req.query.status) {
    filter.status = req.query.status;
  }
  
  const tickets = await Ticket.find(filter)
    .populate('event', 'title dateTime venue coverImage status')
    .sort('-createdAt');
    
  res.status(200).json({
    status: 'success',
    results: tickets.length,
    data: tickets
  });
});

// Get specific ticket
// GET /api/v1/tickets/:id
// Private
exports.getTicket = asyncHandler(async (req, res, next) => {
  const ticket = await Ticket.findById(req.params.id)
    .populate('event', 'title dateTime venue coverImage status organizer')
    .populate('user', 'name email phone');
    
  if (!ticket) {
    return next(new ApiError(`No ticket found for this id ${req.params.id}`, 404));
  }
  
  // Check if user owns the ticket or is admin/organizer
  if (ticket.user._id.toString() !== req.user._id.toString() && 
      req.user.role !== 'admin' && 
      ticket.event.organizer.toString() !== req.user._id.toString()) {
    return next(new ApiError('You are not authorized to access this ticket', 403));
  }
  
  res.status(200).json({
    status: 'success',
    data: ticket
  });
});

// Book ticket
// POST /api/v1/tickets/book
// Private/User
exports.bookTicket = asyncHandler(async (req, res, next) => {
  const { eventId, seatNumber, attendeeInfo, paymentMethod } = req.body;
  
  // 1) Get event and check availability
  const event = await Event.findById(eventId);
  if (!event) {
    return next(new ApiError('Event not found', 404));
  }
  
  if (event.status !== 'published') {
    return next(new ApiError('Event is not available for booking', 400));
  }
  
  if (event.capacity.availableSeats <= 0) {
    return next(new ApiError('No seats available', 400));
  }
  
  if (new Date() > event.dateTime.start) {
    return next(new ApiError('Cannot book tickets for past events', 400));
  }
  
  // 2) Check if seat is already booked
  const existingTicket = await Ticket.findOne({
    event: eventId,
    'seatInfo.seatNumber': seatNumber,
    status: { $in: ['active', 'used'] }
  });
  
  if (existingTicket) {
    return next(new ApiError('This seat is already booked', 400));
  }
  
  // 3) Calculate pricing
  const currentDate = new Date();
  let finalPrice = event.pricing.ticketPrice;
  let discount = 0;
  
  if (event.pricing.earlyBird && 
      event.pricing.earlyBird.deadline > currentDate && 
      event.pricing.earlyBird.price) {
    finalPrice = event.pricing.earlyBird.price;
    discount = event.pricing.ticketPrice - finalPrice;
  }
  
  // 4) Create ticket
  const ticketData = {
    event: eventId,
    user: req.user._id,
    attendeeInfo: attendeeInfo || {
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone
    },
    seatInfo: {
      seatNumber,
      section: req.body.section || 'General',
      row: req.body.row || 'A'
    },
    pricing: {
      originalPrice: event.pricing.ticketPrice,
      finalPrice,
      discount,
      currency: event.pricing.currency
    },
    payment: {
      paymentMethod,
      paymentStatus: paymentMethod === 'cash' ? 'pending' : 'completed',
      paidAt: paymentMethod !== 'cash' ? new Date() : undefined,
      transactionId: paymentMethod !== 'cash' ? `TXN-${Date.now()}` : undefined
    },
    metadata: {
      source: 'web',
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip
    }
  };
  
  const ticket = await Ticket.create(ticketData);
  
  // 5) Generate QR Code
  const qrData = {
    ticketId: ticket._id,
    ticketNumber: ticket.ticketNumber,
    eventId: event._id,
    seatNumber,
    attendeeName: ticketData.attendeeInfo.name
  };
  
  const qrCodeResult = await generateQRCode(JSON.stringify(qrData), ticket.ticketNumber);
  
  // 6) Update ticket with QR code
  ticket.qrCode = {
    data: JSON.stringify(qrData),
    image: qrCodeResult.filePath
  };
  await ticket.save();
  
  // 7) Update event seat count
  await Event.findByIdAndUpdate(eventId, {
    $inc: { 'capacity.soldSeats': 1, 'capacity.availableSeats': -1 }
  });
  
  // 8) Populate ticket for response
  const populatedTicket = await Ticket.findById(ticket._id)
    .populate('event', 'title dateTime venue coverImage')
    .populate('user', 'name email');
  
  res.status(201).json({
    status: 'success',
    message: 'Ticket booked successfully',
    data: populatedTicket
  });
});

// Cancel ticket
// PATCH /api/v1/tickets/:id/cancel
// Private/User
exports.cancelTicket = asyncHandler(async (req, res, next) => {
  const ticket = await Ticket.findById(req.params.id).populate('event');
  
  if (!ticket) {
    return next(new ApiError('Ticket not found', 404));
  }
  
  // Check ownership
  if (ticket.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new ApiError('You can only cancel your own tickets', 403));
  }
  
  if (ticket.status !== 'active') {
    return next(new ApiError('Only active tickets can be cancelled', 400));
  }
  
  // Check if event is too close (e.g., 24 hours before)
  const hoursUntilEvent = (ticket.event.dateTime.start - new Date()) / (1000 * 60 * 60);
  if (hoursUntilEvent < 24) {
    return next(new ApiError('Cannot cancel tickets within 24 hours of event', 400));
  }
  
  // Update ticket status
  ticket.status = 'cancelled';
  ticket.payment.paymentStatus = 'refunded';
  ticket.payment.refundedAt = new Date();
  await ticket.save();
  
  // Update event seat count
  await Event.findByIdAndUpdate(ticket.event._id, {
    $inc: { 'capacity.soldSeats': -1, 'capacity.availableSeats': 1 }
  });
  
  res.status(200).json({
    status: 'success',
    message: 'Ticket cancelled successfully',
    data: ticket
  });
});

// Check-in ticket using QR code
// POST /api/v1/tickets/checkin
// Private/Admin-Manager
exports.checkInTicket = asyncHandler(async (req, res, next) => {
  const { qrData, gate } = req.body;
  
  let ticketInfo;
  try {
    ticketInfo = JSON.parse(qrData);
  } catch (error) {
    return next(new ApiError('Invalid QR code data', 400));
  }
  
  const ticket = await Ticket.findById(ticketInfo.ticketId)
    .populate('event', 'title dateTime status')
    .populate('user', 'name email');
    
  if (!ticket) {
    return next(new ApiError('Ticket not found', 404));
  }
  
  if (ticket.status !== 'active') {
    return next(new ApiError('This ticket is not valid for entry', 400));
  }
  
  if (ticket.checkIn.isCheckedIn) {
    return next(new ApiError('This ticket has already been used', 400));
  }
  
  if (ticket.event.status !== 'published') {
    return next(new ApiError('Event is not active', 400));
  }
  
  // Update check-in status
  ticket.status = 'used';
  ticket.checkIn = {
    isCheckedIn: true,
    checkedInAt: new Date(),
    checkedInBy: req.user._id,
    gate: gate || 'Main Gate'
  };
  
  await ticket.save();
  
  res.status(200).json({
    status: 'success',
    message: 'Ticket checked in successfully',
    data: {
      ticket: ticket.ticketNumber,
      attendee: ticket.attendeeInfo.name,
      event: ticket.event.title,
      seat: ticket.seatInfo.seatNumber,
      checkedInAt: ticket.checkIn.checkedInAt
    }
  });
});

// Get event tickets (for organizers)
// GET /api/v1/tickets/event/:eventId
// Private/Admin-Manager
exports.getEventTickets = asyncHandler(async (req, res, next) => {
  const { eventId } = req.params;
  const event = await Event.findById(eventId);
  if (!event || event.organizer.toString() !== req.user._id.toString()) {
    return next(new ApiError('You can only view tickets for your own events', 403));
  }
  let filter = { event: eventId };
  if (req.query.status) {
    filter.status = req.query.status;
  }
  
  if (req.query.checkedIn) {
    filter['checkIn.isCheckedIn'] = req.query.checkedIn === 'true';
  }
  const tickets = await Ticket.find(filter)
  .populate('user', 'name email phone')
  .sort('-createdAt');
  
  const stats = await Ticket.aggregate([
    { $match: { event: new Types.ObjectId(eventId) } },
    {
      $group: {
        _id: null,
        totalTickets: { $sum: 1 },
        activeTickets: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        usedTickets: { $sum: { $cond: [{ $eq: ['$status', 'used'] }, 1, 0] } },
        cancelledTickets: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
        checkedInTickets: { $sum: { $cond: ['$checkIn.isCheckedIn', 1, 0] } },
        totalRevenue: { $sum: '$pricing.finalPrice' }
      }
    }
  ]);
  
  res.status(200).json({
    status: 'success',
    results: tickets.length,
    stats: stats[0] || {},
    data: tickets
  });
});