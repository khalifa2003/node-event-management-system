const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const ApiError = require('../utils/apiError');

const Event = require('../models/eventModel');
const Ticket = require('../models/ticketModel');
const User = require('../models/userModel');
const Category = require('../models/categoryModel');

// Get dashboard overview stats
// GET /api/v1/analytics/dashboard
// Private/Admin
exports.getDashboardStats = asyncHandler(async (req, res, next) => {
  const currentDate = new Date();
  const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  const thisMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  
  // Basic stats
  const totalEvents = await Event.countDocuments();
  const activeEvents = await Event.countDocuments({ 
    status: 'published',
    'dateTime.end': { $gte: currentDate }
  });
  const totalUsers = await User.countDocuments({ role: 'user' });
  const totalRevenue = await Ticket.aggregate([
    { $match: { 'payment.paymentStatus': 'completed' } },
    { $group: { _id: null, total: { $sum: '$pricing.finalPrice' } } }
  ]);
  
  // This month stats
  const thisMonthEvents = await Event.countDocuments({
    createdAt: { $gte: thisMonth }
  });
  const thisMonthTickets = await Ticket.countDocuments({
    purchaseDate: { $gte: thisMonth },
    'payment.paymentStatus': 'completed'
  });
  const thisMonthRevenue = await Ticket.aggregate([
    { 
      $match: { 
        purchaseDate: { $gte: thisMonth },
        'payment.paymentStatus': 'completed'
      }
    },
    { $group: { _id: null, total: { $sum: '$pricing.finalPrice' } } }
  ]);
  
  // Last month stats for comparison
  const lastMonthEvents = await Event.countDocuments({
    createdAt: { $gte: lastMonth, $lt: thisMonth }
  });
  const lastMonthTickets = await Ticket.countDocuments({
    purchaseDate: { $gte: lastMonth, $lt: thisMonth },
    'payment.paymentStatus': 'completed'
  });
  const lastMonthRevenue = await Ticket.aggregate([
    { 
      $match: { 
        purchaseDate: { $gte: lastMonth, $lt: thisMonth },
        'payment.paymentStatus': 'completed'
      }
    },
    { $group: { _id: null, total: { $sum: '$pricing.finalPrice' } } }
  ]);

  // Calculate growth percentages
  const calculateGrowth = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  res.status(200).json({
    status: 'success',
    data: {
      overview: {
        totalEvents,
        activeEvents,
        totalUsers,
        totalRevenue: totalRevenue[0]?.total || 0,
        totalTicketsSold: await Ticket.countDocuments({ 'payment.paymentStatus': 'completed' })
      },
      thisMonth: {
        events: thisMonthEvents,
        tickets: thisMonthTickets,
        revenue: thisMonthRevenue[0]?.total || 0,
        growth: {
          events: calculateGrowth(thisMonthEvents, lastMonthEvents),
          tickets: calculateGrowth(thisMonthTickets, lastMonthTickets),
          revenue: calculateGrowth(thisMonthRevenue[0]?.total || 0, lastMonthRevenue[0]?.total || 0)
        }
      }
    }
  });
});

// Get sales analytics
// GET /api/v1/analytics/sales
// Private/Admin
exports.getSalesAnalytics = asyncHandler(async (req, res, next) => {
  const { period = '30', groupBy = 'day' } = req.query;
  const days = parseInt(period);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let groupFormat;
  switch (groupBy) {
    case 'hour':
      groupFormat = { $dateToString: { format: "%Y-%m-%d %H:00", date: "$purchaseDate" } };
      break;
    case 'day':
      groupFormat = { $dateToString: { format: "%Y-%m-%d", date: "$purchaseDate" } };
      break;
    case 'week':
      groupFormat = { $week: "$purchaseDate" };
      break;
    case 'month':
      groupFormat = { $dateToString: { format: "%Y-%m", date: "$purchaseDate" } };
      break;
    default:
      groupFormat = { $dateToString: { format: "%Y-%m-%d", date: "$purchaseDate" } };
  }

  const salesData = await Ticket.aggregate([
    {
      $match: {
        purchaseDate: { $gte: startDate },
        'payment.paymentStatus': 'completed'
      }
    },
    {
      $group: {
        _id: groupFormat,
        ticketsSold: { $sum: 1 },
        revenue: { $sum: '$pricing.finalPrice' },
        averagePrice: { $avg: '$pricing.finalPrice' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Revenue by payment method
  const paymentMethods = await Ticket.aggregate([
    {
      $match: {
        purchaseDate: { $gte: startDate },
        'payment.paymentStatus': 'completed'
      }
    },
    {
      $group: {
        _id: '$payment.paymentMethod',
        count: { $sum: 1 },
        revenue: { $sum: '$pricing.finalPrice' }
      }
    }
  ]);

  // Top selling events
  const topEvents = await Ticket.aggregate([
    {
      $match: {
        purchaseDate: { $gte: startDate },
        'payment.paymentStatus': 'completed'
      }
    },
    {
      $group: {
        _id: '$event',
        ticketsSold: { $sum: 1 },
        revenue: { $sum: '$pricing.finalPrice' }
      }
    },
    { $sort: { ticketsSold: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'events',
        localField: '_id',
        foreignField: '_id',
        as: 'eventDetails'
      }
    },
    {
      $project: {
        ticketsSold: 1,
        revenue: 1,
        eventTitle: { $arrayElemAt: ['$eventDetails.title', 0] },
        eventDate: { $arrayElemAt: ['$eventDetails.dateTime.start', 0] }
      }
    }
  ]);
  const totalRevenue = salesData.reduce((sum, item) => sum + item.revenue, 0);
  const totalTickets = salesData.reduce((sum, item) => sum + item.ticketsSold, 0);
  res.status(200).json({
    status: 'success',
    data: {
      salesTrend: salesData,
      paymentMethods,
      topEvents,
      summary: {
        totalTickets: salesData.reduce((sum, item) => sum + item.ticketsSold, 0),
        totalRevenue: salesData.reduce((sum, item) => sum + item.revenue, 0),
        averageOrderValue: totalTickets ? totalRevenue / totalTickets : 0
      }
    }
  });
});

// Get audience demographics
// GET /api/v1/analytics/demographics
// Private/Admin
exports.getAudienceDemographics = asyncHandler(async (req, res, next) => {
  const { eventId } = req.query;
  let matchStage = { 'payment.paymentStatus': 'completed' };
  
  if (eventId) {
    matchStage.event = mongoose.Types.ObjectId(eventId);
  }

  // Age distribution
  const ageDistribution = await Ticket.aggregate([
    { $match: matchStage },
    {
      $addFields: {
        ageGroup: {
          $switch: {
            branches: [
              { case: { $and: [{ $gte: ['$attendeeInfo.age', 18] }, { $lt: ['$attendeeInfo.age', 25] }] }, then: '18-24' },
              { case: { $and: [{ $gte: ['$attendeeInfo.age', 25] }, { $lt: ['$attendeeInfo.age', 35] }] }, then: '25-34' },
              { case: { $and: [{ $gte: ['$attendeeInfo.age', 35] }, { $lt: ['$attendeeInfo.age', 45] }] }, then: '35-44' },
              { case: { $and: [{ $gte: ['$attendeeInfo.age', 45] }, { $lt: ['$attendeeInfo.age', 55] }] }, then: '45-54' },
              { case: { $gte: ['$attendeeInfo.age', 55] }, then: '55+' }
            ],
            default: 'Unknown'
          }
        }
      }
    },
    {
      $group: {
        _id: '$ageGroup',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

  // Gender distribution
  const genderDistribution = await Ticket.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$attendeeInfo.gender',
        count: { $sum: 1 }
      }
    }
  ]);

  // Location distribution (by city from user data)
  const locationDistribution = await Ticket.aggregate([
    { $match: matchStage },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'userDetails'
      }
    },
    {
      $addFields: {
        userCity: { $arrayElemAt: ['$userDetails.addresses.0.city', 0] }
      }
    },
    {
      $group: {
        _id: '$userCity',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  // Purchase patterns by time
  const purchasePatterns = await Ticket.aggregate([
    { $match: matchStage },
    {
      $addFields: {
        hour: { $hour: '$purchaseDate' },
        dayOfWeek: { $dayOfWeek: '$purchaseDate' }
      }
    },
    {
      $group: {
        _id: { hour: '$hour', dayOfWeek: '$dayOfWeek' },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      ageDistribution,
      genderDistribution,
      locationDistribution,
      purchasePatterns: {
        byHour: purchasePatterns
          .reduce((acc, item) => {
            const existing = acc.find(x => x._id === item._id.hour);
            if (existing) {
              existing.count += item.count;
            } else {
              acc.push({ _id: item._id.hour, count: item.count });
            }
            return acc;
          }, [])
          .sort((a, b) => a._id - b._id),
        byDayOfWeek: purchasePatterns
          .reduce((acc, item) => {
            const existing = acc.find(x => x._id === item._id.dayOfWeek);
            if (existing) {
              existing.count += item.count;
            } else {
              acc.push({ _id: item._id.dayOfWeek, count: item.count });
            }
            return acc;
          }, [])
          .sort((a, b) => a._id - b._id)
      }
    }
  });
});

// Get event performance analytics
// GET /api/v1/analytics/events/performance
// Private/Admin
exports.getEventPerformance = asyncHandler(async (req, res, next) => {
  const { eventId, organizerId } = req.query;
  let matchStage = {};
  
  if (eventId) {
    matchStage._id = mongoose.Types.ObjectId(eventId);
  }
  if (organizerId) {
    matchStage.organizer = mongoose.Types.ObjectId(organizerId);
  }

  const eventPerformance = await Event.aggregate([
    { $match: matchStage },
    {
      $lookup: {
        from: 'tickets',
        let: { eventId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$event', '$$eventId'] } } },
          {
            $facet: {
              sold: [
                { $match: { 'payment.paymentStatus': 'completed' } },
                { $count: 'count' }
              ],
              revenue: [
                { $match: { 'payment.paymentStatus': 'completed' } },
                { $group: { _id: null, total: { $sum: '$pricing.finalPrice' } } }
              ],
              checkedIn: [
                { $match: { 'checkIn.isCheckedIn': true } },
                { $count: 'count' }
              ]
            }
          }
        ],
        as: 'ticketStats'
      }
    },
    {
      $lookup: {
        from: 'reviews',
        localField: '_id',
        foreignField: 'event',
        as: 'reviews'
      }
    },
    {
      $addFields: {
        ticketsSold: { $arrayElemAt: ['$ticketStats.sold.count', 0] },
        revenue: { $arrayElemAt: ['$ticketStats.revenue.total', 0] },
        checkedInCount: { $arrayElemAt: ['$ticketStats.checkedIn.count', 0] },
        averageRating: { $avg: '$reviews.rating' },
        reviewsCount: { $size: '$reviews' },
        occupancyRate: {
          $multiply: [
            { $divide: [{ $arrayElemAt: ['$ticketStats.sold.count', 0] }, '$capacity.totalSeats'] },
            100
          ]
        },
        attendanceRate: {
          $cond: {
            if: { $gt: [{ $arrayElemAt: ['$ticketStats.sold.count', 0] }, 0] },
            then: {
              $multiply: [
                { $divide: [{ $arrayElemAt: ['$ticketStats.checkedIn.count', 0] }, { $arrayElemAt: ['$ticketStats.sold.count', 0] }] },
                100
              ]
            },
            else: 0
          }
        }
      }
    },
    {
      $project: {
        title: 1,
        status: 1,
        'dateTime.start': 1,
        'venue.name': 1,
        'venue.city': 1,
        'capacity.totalSeats': 1,
        'pricing.ticketPrice': 1,
        views: 1,
        ticketsSold: { $ifNull: ['$ticketsSold', 0] },
        revenue: { $ifNull: ['$revenue', 0] },
        checkedInCount: { $ifNull: ['$checkedInCount', 0] },
        averageRating: { $ifNull: ['$averageRating', 0] },
        reviewsCount: 1,
        occupancyRate: { $ifNull: ['$occupancyRate', 0] },
        attendanceRate: { $ifNull: ['$attendanceRate', 0] }
      }
    },
    { $sort: { 'dateTime.start': -1 } }
  ]);

  // Category performance
  const categoryPerformance = await Event.aggregate([
    { $match: matchStage },
    {
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        as: 'categoryDetails'
      }
    },
    {
      $lookup: {
        from: 'tickets',
        let: { eventId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$event', '$eventId'] } } },
          { $match: { 'payment.paymentStatus': 'completed' } }
        ],
        as: 'soldTickets'
      }
    },
    {
      $group: {
        _id: '$category',
        categoryName: { $first: { $arrayElemAt: ['$categoryDetails.name', 0] } },
        eventsCount: { $sum: 1 },
        totalTicketsSold: { $sum: { $size: '$soldTickets' } },
        totalRevenue: {
          $sum: {
            $reduce: {
              input: '$soldTickets',
              initialValue: 0,
              in: { $add: ['$$value', '$$this.pricing.finalPrice'] }
            }
          }
        },
        averageOccupancy: { $avg: { $multiply: [{ $divide: [{ $size: '$soldTickets' }, '$capacity.totalSeats'] }, 100] } }
      }
    },
    { $sort: { totalRevenue: -1 } }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      events: eventPerformance,
      categories: categoryPerformance,
      summary: {
        totalEvents: eventPerformance.length,
        totalRevenue: eventPerformance.reduce((sum, event) => sum + event.revenue, 0),
        totalTicketsSold: eventPerformance.reduce((sum, event) => sum + event.ticketsSold, 0),
        averageOccupancy: eventPerformance.reduce((sum, event) => sum + event.occupancyRate, 0) / (eventPerformance.length || 1),
        averageAttendance: eventPerformance.reduce((sum, event) => sum + event.attendanceRate, 0) / (eventPerformance.length || 1)
      }
    }
  });
});

// Export analytics data to CSV
// GET /api/v1/analytics/export
// Private/Admin
exports.exportAnalytics = asyncHandler(async (req, res, next) => {
  const { type, startDate, endDate, eventId } = req.query;
  
  let data = [];
  let filename = '';
  
  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lte = new Date(endDate);
  
  switch (type) {
    case 'tickets':
      const tickets = await Ticket.find({
        ...(Object.keys(dateFilter).length && { purchaseDate: dateFilter }),
        ...(eventId && { event: eventId }),
        'payment.paymentStatus': 'completed'
      })
        .populate('event', 'title dateTime venue')
        .populate('user', 'name email')
        .select('ticketNumber attendeeInfo seatInfo pricing purchaseDate checkIn');
      
      data = tickets.map(ticket => ({
        'Ticket Number': ticket.ticketNumber,
        'Event': ticket.event.title,
        'Event Date': ticket.event.dateTime.start.toISOString().split('T')[0],
        'Attendee Name': ticket.attendeeInfo.name,
        'Email': ticket.attendeeInfo.email,
        'Seat': ticket.seatInfo.seatNumber,
        'Price': ticket.pricing.finalPrice,
        'Purchase Date': ticket.purchaseDate.toISOString().split('T')[0],
        'Checked In': ticket.checkIn.isCheckedIn ? 'Yes' : 'No'
      }));
      filename = `tickets-export-${Date.now()}.csv`;
      break;
      
    case 'events':
      const events = await Event.find({
        ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
        ...(eventId && { _id: eventId })
      })
        .populate('category', 'name')
        .populate('organizer', 'name email')
        .select('title status dateTime venue capacity pricing views');
      
      data = events.map(event => ({
        'Title': event.title,
        'Status': event.status,
        'Category': event.category?.name || '',
        'Start Date': event.dateTime.start.toISOString().split('T')[0],
        'Venue': event.venue.name,
        'City': event.venue.city,
        'Total Seats': event.capacity.totalSeats,
        'Available Seats': event.capacity.availableSeats,
        'Sold Seats': event.capacity.soldSeats,
        'Ticket Price': event.pricing.ticketPrice,
        'Views': event.views,
        'Organizer': event.organizer?.name || ''
      }));
      filename = `events-export-${Date.now()}.csv`;
      break;
      
    default:
      return next(new ApiError('Invalid export type', 400));
  }
  
  // Convert to CSV
  if (data.length === 0) {
    return next(new ApiError('No data found for export', 404));
  }
  
  const csv = [
    Object.keys(data[0]).join(','),
    ...data.map(row => Object.values(row).map(val => `"${val}"`).join(','))
  ].join('\n');
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csv);
});