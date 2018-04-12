'use strict';

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _util = require('util');

var _util2 = _interopRequireDefault(_util);

var _cors = require('cors');

var _cors2 = _interopRequireDefault(_cors);

var _monk = require('monk');

var _monk2 = _interopRequireDefault(_monk);

var _https = require('https');

var _https2 = _interopRequireDefault(_https);

var _querystring = require('querystring');

var _querystring2 = _interopRequireDefault(_querystring);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

require('body-parser-xml')(_bodyParser2.default);


var app = (0, _express2.default)();
var port = process.env.port || process.env.PORT || 8000;
var db = (0, _monk2.default)(process.env.MONGODB_URI);
var teamviewer_db = db.get('teamviewer'); // used for storage of teamviewer oauth data


if (!port) {
  console.log('Error: Port not found');
  process.exit(1);
}

app.set('port', port);
app.set('view engine', 'html');
app.set('layout', 'layout');
app.engine('html', require('hogan-express'));
app.set('views', _path2.default.join(__dirname, './../views'));

app.use(_express2.default.static(_path2.default.join(__dirname, '../public')));
app.use(_bodyParser2.default.urlencoded({ extended: true }));
app.use(_bodyParser2.default.json({ type: 'application/json' }));
app.use(_bodyParser2.default.xml({ xmlParseOptions: {
    explicitArray: false
  } }));
app.use((0, _cors2.default)());
app.options('*', (0, _cors2.default)());

app.get('/', function (req, res) {
  res.render('layout', {
    partials: {
      logmein: 'logmein.html'
      // bomgar: 'bomgar.html',
      // harvest: 'harvest.html',
      // teamviewer: 'teamviewer.html'
    }
  });
});

app.get('/tv/data/:id', function (req, res) {
  console.log('[GET] /tv/data --> user: ' + req.params.id);

  var id = req.params.id;

  var response_json = {
    tv_id: process.env.TEAMVIEWER_ID
  };

  teamviewer_db.findOne({ user: id }).then(function (found) {
    if (found) {
      console.log('[GET] /tv/data --> tokens found\n' + _util2.default.inspect(found));
      response_json['tokens'] = found.teamviewer;
    }
    res.send(response_json);
  });
});

app.get('/tv/authorized', function (req, res, next) {
  var options = {
    root: _path2.default.join(__dirname, '../public/html/')
  };

  res.sendFile('oauthcallback.html', options, function (err) {
    if (err) next(err);else console.log('...sending oauthcallback page');
  });
});

app.get('/tv/oauth', function (req, res) {
  console.log('[GET] /tv/oauth');
  console.log('>>> code: ' + req.query.code);
  console.log('>>> state: ' + req.query.state);

  var code = req.query.code;

  var postData = _querystring2.default.stringify({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: 'https://samanage-widgets.herokuapp.com/tv/oauth',
    client_id: process.env.TEAMVIEWER_ID,
    client_secret: process.env.TEAMVIEWER_SECRET
  });

  var options = {
    host: 'webapi.teamviewer.com',
    path: '/api/v1/oauth2/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': postData.length
    }
  };

  var request = _https2.default.request(options, function (response) {
    var result = '';

    response.on('data', function (chunk) {
      result += chunk;
    });

    response.on('end', function () {
      console.log('>>> success!\n' + _util2.default.inspect(result));
      result = JSON.parse(result);

      var query = _querystring2.default.stringify({
        access_token: result.access_token,
        token_type: result.token_type,
        expires_in: result.expires_in,
        refresh_token: result.refresh_token,
        user_id: req.query.state
      });

      var teamviewer = result;

      teamviewer_db.findOne({ user: req.query.state }).then(function (found) {
        if (!found) {
          teamviewer_db.insert({ user: req.query.state, teamviewer: teamviewer });
        } else {
          console.log('> user already has teamviewer authentication');
        }

        res.redirect('/tv/authorized?' + query);
      });
    });

    response.on('error', function (e) {
      console.log('[error in post response]' + e);
    });
  });

  request.on('error', function (e) {
    console.log('[error in post request] >> ' + e);
  });

  request.write(postData);
  request.end();
});

app.post('/tv/sessions/new/:id', function (req, res) {
  console.log('\n[POST] recieved at /tv/sessions/new/' + req.params.id);

  var id = req.params.id;
  var postData = JSON.stringify(req.body);

  console.log('\nrequest body: ' + _util2.default.inspect(req.body));

  teamviewer_db.findOne({ user: id }).then(function (found) {
    if (found) {
      console.log('> user found in db');

      var options = {
        host: 'webapi.teamviewer.com',
        path: '/api/v1/sessions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + found.teamviewer.access_token
        }
      };

      var request = _https2.default.request(options, function (response) {
        var result = '';

        response.on('data', function (chunk) {
          result += chunk;
        });

        response.on('end', function () {
          console.log('>>> end\n' + _util2.default.inspect(result));
          result = JSON.parse(result);
          var teamviewer = result;
          res.send(teamviewer);
        });

        response.on('error', function (e) {
          console.log('[error in post response]' + e);
        });
      });

      request.on('error', function (e) {
        console.log('[Error in new session POST request]\n>> ' + e);
        res.status(500);
      });

      request.write(postData);
      request.end();
    } else {
      res.send(500);
    }
  });
});

app.get('/tv/:id/oauth/', function (req, res) {
  console.log('[GET] /tv/oauth');
  console.log('>>> id: ' + req.params.id);

  var id = req.params.id;

  teamviewer_db.findOne({ user: id }).then(function (found) {
    if (found) {
      var postData = _querystring2.default.stringify({
        grant_type: 'refresh_token',
        refresh_token: found.teamviewer.refresh_token,
        client_id: process.env.TEAMVIEWER_ID,
        client_secret: process.env.TEAMVIEWER_SECRET
      });

      var options = {
        host: 'webapi.teamviewer.com',
        path: '/api/v1/oauth2/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': postData.length
        }
      };

      var request = _https2.default.request(options, function (response) {
        var result = '';

        response.on('data', function (chunk) {
          result += chunk;
        });

        response.on('end', function () {
          console.log('>>> success!\n' + _util2.default.inspect(result));
          result = JSON.parse(result);

          var query = _querystring2.default.stringify({
            access_token: result.access_token,
            token_type: result.token_type,
            expires_in: result.expires_in,
            refresh_token: result.refresh_token,
            user_id: req.query.state
          });

          var teamviewer = result;

          teamviewer_db.insert({ user: req.query.state, teamviewer: teamviewer }); // this would be the Samanage account id
          res.end();
        });

        response.on('error', function (e) {
          console.log('[error in post response]' + e);
        });
      });

      request.on('error', function (e) {
        console.log('[error in post request] >> ' + e);
      });

      request.write(postData);
      request.end();
    } else {
      console.log('ERROR: User not found');
    }
  });
});

// this is going to be the endpoint that needs a backend function to handle the data to comment
app.post('/data', function (req, res) {
  console.log('[POST] at /data ==> request: ' + _util2.default.inspect(req.body));
  res.send(200);
});

var server = app.listen(app.get('port'), function () {
  console.log('> App listening on port: ' + server.address().port);
  console.log('  Press Ctrl+C to quit');
});