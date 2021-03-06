var _ = require('underscore')._,
    bodyParser = require('body-parser'),
    bytes = require('bytes'),
    cookieParser = require('cookie-parser'),
    device = require('express-device'),
    express = require('express'),
    favicon = require('serve-favicon'),
    fs = require('fs'),
    http = require('http'),
    https = require('https'),
    multer = require('multer'),
    path = require('path'),
    process = require('process'),
    redis = require('redis');

var config = require('./config'),
    isTrue = require('./truthiness'),
    types = require('./types');

var app = express();

app.locals.config = config;

// server

function homeResolve(str) {
  if(str.substr(0,2) == '~/') {
    var home = process.env.HOME || process.env.HOMEPATH ||
               process.env.HOMEDIR || process.cwd();

    str = path.join(home, str.substr(2));
  }

  return path.resolve(str);
}

var server;
if(_.has(config, 'tls') && config.tls.enabled &&
   _.has(config.tls, 'key') && _.has(config.tls, 'cert'))
{
  var options = {
    key: fs.readFileSync(homeResolve(config.tls.key)).toString(),
    cert: fs.readFileSync(homeResolve(config.tls.cert)).toString()
  };

  server = https.createServer(options, app);
  console.log("> TLS enabled");
}
else {
  server = http.createServer(app);
}

app.set('server', server);

// database handle

var db = redis.createClient();
if(_.has(config, 'database')) {
  console.log("> Selecting database " + config.database);
  db.select(config.database);
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

// middleware

function configureUploads(textSize, fileSize) {
  var upload = multer({
    limits: {
      fields: 5,
      fieldSize: bytes.parse(textSize) || config.size_limits.text_upload,
      fileSize: bytes.parse(fileSize)  || config.size_limits.file_upload
    },
    storage: multer.diskStorage({
      destination: function(req, file, callback) {
        callback(null, path.resolve(__dirname + '/files/'));
      },
      filename: function(request, file, callback) {
        var fileExt = types.fileExtension(file.originalname);
        if(fileExt != null) {
          callback(null, shortid.generate() + '.' + fileExt);
        } else {
          callback(null, shortid.generate());
        };
      },
    }),
  });

  app.set('textUploader', upload.array());
  app.set('fileUploader', upload.single('file'));
}

app.locals.configureUploads = configureUploads;
configureUploads(config.size_limits.text_upload || null,
                 config.size_limits.file_upload || null);

app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());
app.use(device.capture({'parseUserAgent': true}));
app.use(express.static(__dirname + '/public'));

// use favicon if it exists
var faviconPath = __dirname + '/public/favicon.ico';
try {
  fs.accessSync(faviconPath, fs.F_OK);
  app.use(favicon(faviconPath));
}
catch(e) {
  console.log("> Note: No favicon found in /public");
}

// request and response management
app.use(function(req, res, next) {
  req.apiRequest = _.has(req.headers, 'api') && isTrue(req.headers.api);

  res.api = function(error, data) {
    data.error = error;
    this.setHeader('Content-Type', 'application/json');
    this.json(data);
  }.bind(res);

  res.apiMessage = function(error, message) {
    this.api(error, { 'message': message });
  }.bind(res);

  res.dbError = function() {
    this.status(500);
    if(req.apiRequest) {
      this.api(true, {'message': "Database error."});
    }
    else {
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
app.use('/', require('./routes/listings.js'));
app.use('/', require('./routes/uploads.js'));
app.use('/', require('./routes/settings.js'));
app.use('/', require('./routes/login.js'));
app.use('/', require('./routes/registration.js'));
app.use('/', require('./routes/fileActions.js'));
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
