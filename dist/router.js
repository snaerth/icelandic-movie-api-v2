'use strict';

var authentication = require('./controllers/authentication');
var passport = require('passport');
var passportService = require('./services/passport');

// Initialize require authentication helpers
var requireAuth = passport.authenticate('jwt', {
  session: false
});

var requireSignin = passport.authenticate('local', {
  session: false
});

module.exports = function (app) {
  app.get('/api', requireAuth, function (req, res) {
    res.send('hurra');
  });

  app.post('/signup', authentication.signup);
  app.post('/signin', requireSignin, authentication.signin);
};