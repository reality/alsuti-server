var _ = require('underscore')._,
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    device = require('express-device'),
    express = require('express'),
    favicon = require('serve-favicon'),
    fs = require('fs'),
    path = require('path'),
    process = require('process'),
    redis = require('redis'),
    sys = require('sys');

var isTrue = require('./truthiness.js'),
    types = require('./types.js');

var app = express();

// database handle

var db = redis.createClient();
if(_.has(process.env, 'ALSUTI_DATABASE')) {
  db.select(process.env.ALSUTI_DATABASE);
}

db.on("error", function(err) {
  console.log("Error: " + err);
});

// app globals
app.set('database', db);
app.set('cookieAge', 1000 * 60 * 60 * 24 * 14); // for a maximum of 2 weeks
app.set('sessionAge', 1000 * 60 * 60 * 4);      // .. enforce a 4 hour activity timeout
app.set('maxCookieAge', 1000 * 60 * 60 * 720);  // but 2 years for non-expiring sessions

// view engine setup
app.set('json spaces', 2);
app.set('view engine', 'jade');
app.set('views', __dirname + '/views');

// pretty html output
app.locals.pretty = true;

// use favicon if it exists
var faviconPath = __dirname + '/public/favicon.ico';
try {
  fs.accessSync(faviconPath, fs.F_OK);
  app.use(favicon(faviconPath));
}
catch(e) {
  console.log("Note: no favicon found.");
  // make browsers stfu about it
  app.use('/favicon.ico', function(req, res) { res.status(404); res.end(); });
}

// middleware
app.use(bodyParser.urlencoded({ extended: true, limit: '512mb' }));
app.use(cookieParser());
app.use(device.capture({'parseUserAgent': true}));
app.use(express.static(__dirname + '/public'));

// request and response management
app.use(function(req, res, next) {
  req.apiRequest = _.has(req.headers, 'api') && isTrue(req.headers.api);

  res.api = function(err, data) {
    data.error = err;
    this.setHeader('Content-Type', 'application/json');
    this.json(data);
  }.bind(res);

  res.dbError = function() {
    if(req.apiRequest) {
      this.api(true, {'message': "Database error."});
    } else {
      this.render('info', {
        'error': true,
        'title': "Database Error",
        'message': "Something went wrong."
      });
    }
  }.bind(res);

  next();
});

// session management
app.use(require('./auth.js').handleSession);

// primary routes -- in order of most likely used (except for the file view)
app.use('/', require('./routes/login.js'));
app.use('/', require('./routes/listings.js'));
app.use('/', require('./routes/uploads.js'));
app.use('/', require('./routes/fileActions.js'));
app.use('/', require('./routes/settings.js'));
app.use('/', require('./routes/registration.js'));
// this has to be last since it can match any single parameter under /
app.use('/', require('./routes/fileView.js'));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error("Not Found");
  err.status = 404;
  next(err);
});

var mode = process.env.NODE_ENV || 'development';
if(mode == 'development') {
  // development error handler; prints stacktrace
  app.use(function(err, req, res, next) {
    if(res.headersSent) {
      return next(err);
    }

    res.status(err.status || 500);
    res.render('error', {
      'e': err
    });
  });
}
else {
  // production error handler; no stacktrace
  app.use(function(err, req, res, next) {
    if(res.headersSent) {
      return next(err);
    }

    err.stack = null;
    res.status(err.status || 500);
    res.render('error', {
      'e': err
    });
  });
}

module.exports = app;
