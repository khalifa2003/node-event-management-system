const userRoute = require('./userRoute');
const authRoute = require('./authRoute');
const addressRoute = require('./addressRoute');
const categoryRoute = require('./categoryRoute');
const ticketRoute = require('./ticketRoute');
const analyticsRoute = require('./analyticsRoute');
const eventRoute = require('./eventRoute');
// const reviewRoute = require('./reviewRoute');

const mountRoutes = (app) => {
  app.use('/api/v1/users', userRoute);
  app.use('/api/v1/auth', authRoute);
  app.use('/api/v1/addresses', addressRoute);
  app.use('/api/v1/categories', categoryRoute);
  app.use('/api/v1/tickets', ticketRoute);
  app.use('/api/v1/analytics', analyticsRoute);
  // app.use('/api/v1/events', eventRoute);
  // app.use('/api/v1/reviews', reviewRoute);
};

module.exports = mountRoutes;