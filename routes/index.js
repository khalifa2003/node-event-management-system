const userRoute = require('./userRoute');
const authRoute = require('./authRoute');
const addressRoute = require('./addressRoute');
const mountRoutes = (app) => {
  app.use('/api/v1/users', userRoute);
  app.use('/api/v1/auth', authRoute);
  app.use('/api/v1/addresses', addressRoute);
};

module.exports = mountRoutes;