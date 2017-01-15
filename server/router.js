const authentication = require('./controllers/authentication');
const passport = require('passport');
const passportService = require('./services/passport');

// Initialize require authentication helpers
const requireAuth = passport.authenticate('jwt', {
  session: false
});

const requireSignin = passport.authenticate('local', {
  session: false
});

module.exports = (app) => {
  app.get('/api', requireAuth, (req, res) => {
    res.send('hurra');
  });

  app.post('/signup', authentication.signup);
  app.post('/signin', requireSignin, authentication.signin);
}