const asyncHandler = require('express-async-handler');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

const factory = require('./handlersFactory');
const ApiError = require('../utils/apiError');
const { uploadMixOfImages } = require('../middlewares/uploadImageMiddleware');
const Event = require('../models/eventModel');
const Ticket = require('../models/ticketModel');
const fs = require('fs-extra');
const path = require('path');
const uploadsDir = path.join(__dirname, '../uploads/events');
fs.ensureDirSync(uploadsDir);
exports.uploadEventImages = uploadMixOfImages([
  { name: 'coverImage', maxCount: 1 },
  { name: 'images', maxCount: 5 }
]);
exports.resizeEventImages = asyncHandler(async (req, res, next) => {
  // 1- Cover image processing
  if (req.files.coverImage) {
    const coverImageName = `event-cover-${uuidv4()}-${Date.now()}.jpeg`;
    await sharp(req.files.coverImage[0].buffer)
      .resize(1200, 600)
      .toFormat('jpeg')
      .jpeg({ quality: 90 })
      .toFile(`uploads/events/${coverImageName}`);
    req.body.coverImage = coverImageName;
  }

  // 2- Images processing
  if (req.files.images) {
    req.body.images = [];
    await Promise.all(
      req.files.images.map(async (img, index) => {
        const imageName = `event-${uuidv4()}-${Date.now()}-${index + 1}.jpeg`;
        await sharp(img.buffer)
          .resize(800, 600)
          .toFormat('jpeg')
          .jpeg({ quality: 90 })
          .toFile(`uploads/events/${imageName}`);
        req.body.images.push(imageName);
      })
    );
  }
  next();
});

// Get all events with advanced filtering and search
// GET /api/v1/events
// Public
exports.getEvents = asyncHandler(async (req, res, next) => {
  let filter = {};
  if (req.query.category) {
    filter.category = req.query.category;
  }
  if (req.query.city) {
    filter['venue.city'] = new RegExp(req.query.city, 'i');
  }
  if (req.query.startDate || req.query.endDate) {
    filter['dateTime.start'] = {};
    if (req.query.startDate) filter['dateTime.start'].$gte = new Date(req.query.startDate);
    if (req.query.endDate) filter['dateTime.start'].$lte = new Date(req.query.endDate);
  }
  if (req.query.minPrice || req.query.maxPrice) {
    filter['pricing.ticketPrice'] = {};
    if (req.query.minPrice) {
      filter['pricing.ticketPrice']['$gte'] = parseInt(req.query.minPrice);
    }
    if (req.query.maxPrice) {
      filter['pricing.ticketPrice']['$lte'] = parseInt(req.query.maxPrice);
    }
  }
  if (req.user && (req.user.role === 'admin' || req.user.role === 'manager')) {
    if (req.query.status) {
      filter.status = req.query.status;
    }
  } else {
    filter.status = 'published';
  }
  if (req.query.search) {
    filter.$text = { $search: req.query.search };
  }
  let query = Event.find(filter)
    .populate('category', 'name slug color')
    .populate('organizer', 'name email profileImg')
  
  // Sorting
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    query = query.sort(sortBy);
  } else {
    query = query.sort('-createdAt');
  }
  
  // Pagination
  const page = req.query.page * 1 || 1;
  const limit = req.query.limit * 1 || 10;
  const skip = (page - 1) * limit;
  
  query = query.skip(skip).limit(limit);
  
  // Execute query
  const events = await query;
  const total = await Event.countDocuments(filter);
  
  res.status(200).json({
    status: 'success',
    results: events.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: events
  });
});

// Get specific event by id or slug
// GET /api/v1/events/:id
// Public
exports.getEvent = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  let query;
  
  if (id.match(/^[0-9a-fA-F]{24}$/)) {
    query = Event.findById(id);
  } else {
    query = Event.findOne({ slug: id });
  }
  
  const event = await query
    .populate('category', 'name slug color')
    .populate('organizer', 'name email profileImg phone')
    .populate({
      path: 'reviews',
      select: 'rating title comment user createdAt',
      populate: { path: 'user', select: 'name profileImg' }
    });
  
  if (!event) {
    return next(new ApiError(`No event found for this id/slug ${id}`, 404));
  }
  
  // Increment views
  await Event.findByIdAndUpdate(event._id, { $inc: { views: 1 } });
  
  res.status(200).json({
    status: 'success',
    data: event
  });
});

// Create event
// POST /api/v1/events
// Private/Admin-Manager
exports.createEvent = asyncHandler(async (req, res, next) => {
  req.body.organizer = req.user._id;
  const event = await Event.create(req.body);
  res.status(201).json({ data: event });
});

// Update specific event
// PUT /api/v1/events/:id
// Private/Admin-Manager
exports.updateEvent = factory.updateOne(Event);

// Delete specific event
// DELETE /api/v1/events/:id
// Private/Admin-Manager
exports.deleteEvent = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  
  // Check if event has sold tickets
  const soldTickets = await Ticket.countDocuments({
    event: id,
    'payment.paymentStatus': 'completed'
  });
  
  if (soldTickets > 0) {
    return next(new ApiError('Cannot delete event with sold tickets', 400));
  }
  
  const event = await Event.findByIdAndDelete(id);
  if (!event) {
    return next(new ApiError(`No event found for this id ${id}`, 404));
  }
  
  res.status(204).send();
});

// Get events by organizer
// GET /api/v1/events/my-events
// Private/Admin-Manager
exports.getMyEvents = asyncHandler(async (req, res, next) => {
  let filter = { organizer: req.user._id };
  
  if (req.query.status) {
    filter.status = req.query.status;
  }
  
  const events = await Event.find(filter)
    .populate('category', 'name slug')
    .populate('reviews', 'rating')
    .sort('-createdAt');
    
  res.status(200).json({
    status: 'success',
    results: events.length,
    data: events
  });
});

// Get popular events
// GET /api/v1/events/popular
// Public
exports.getPopularEvents = asyncHandler(async (req, res, next) => {
  const events = await Event.find({
    status: 'published',
    'dateTime.start': { $gte: new Date() }
  })
    .populate('category', 'name slug color')
    .sort('-views -capacity.soldSeats')
    .limit(8);
    
  res.status(200).json({
    status: 'success',
    results: events.length,
    data: events
  });
});