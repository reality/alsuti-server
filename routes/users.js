var _ = require('underscore'),
    express = require('express'),
    shortid = require('shortid'),
    requireAuth = require('./userauth');

var router = express.Router();

router.get('/login', function(req, res) {
  res.render('login', {
      'title': "Alsuti Login"
  });
});

router.post('/login', requireAuth);
router.post('/login', function(req, res) {
  var db = req.app.get('database');
      userHash = 'user:' + req.body.user,
      sessionKey = shortid.generate(),
      sessionExpiry = Date.now() + req.app.get('sessionAge');

  // store sessionKey in database
  db.hmset(userHash, ['sessionKey', sessionKey, 'sessionExpiry', sessionExpiry],
  function(err, reply) {
    if(!err) {
      var cookieOptions = {
        maxAge: req.app.get('cookieAge'),
        httpOnly: true
      };

      // set session cookies
      res.cookie('sessionUser', req.sessionUser, cookieOptions);
      res.cookie('sessionKey', sessionKey, cookieOptions);

      // redirect
      res.redirect('/');
    }
    else {
      res.render('error', {
        'title': "Database Error",
        'message': "Cannot store session."
      });
    }
  });
});

router.get('/logout', function(req, res) {
  var redirPath = req.headers['Referer'] || '/';

  if(_.has(req.cookies, 'sessionUser') == false) {
    res.redirect(redirPath);
    return;
  }

  var db = req.app.get('database'),
      userHash = 'user:' + req.cookies['sessionUser'];

  db.hdel(userHash, 'sessionKey', 'sessionExpiry');

  var options = {
    'expires': new Date(0),
    'httpOnly': true
  }

  res.cookie("sessionUser", "", options);
  res.cookie("sessionKey", "", options);
  res.redirect(redirPath);
});

module.exports = router;
