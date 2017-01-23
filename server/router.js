import authentication from './controllers/authentication';
import passport from 'passport';
import passportService from './services/passport';

// Initialize require authentication helpers
const requireAuth = passport.authenticate('jwt', {
  session: false
});

const requireSignin = passport.authenticate('local', {
  session: false
});

module.exports = (app) => {
  app.get('/', (req, res, next) => {
    res.send('index');
  });

  app.get('/api', requireAuth, (req, res) => {
    res.send('hurra');
  });

  app.post('/signup', authentication.signup);
  app.post('/signin', requireSignin, authentication.signin);
}