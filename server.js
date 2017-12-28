/* eslint no-console: 0 */

const path = require('path');
const express = require('express');
const webpack = require('webpack');
const webpackMiddleware = require('webpack-dev-middleware');
const webpackHotMiddleware = require('webpack-hot-middleware');
const config = require('./webpack.config.js');
const isDeveloping = process.env.NODE_ENV !== 'production';
const port = isDeveloping ? 3000 : process.env.PORT;
const app = express();
const http = require("http");
const socketIo = require("socket.io");
const axios = require("axios");

var server = require('http').createServer(app);
var io = require('socket.io')(server);

const apiai = require('apiai')('2296d508caf64606a675ec8aacc2aede');

// if (isDeveloping) {
const compiler = webpack(config);
const middleware = webpackMiddleware(compiler, {
  publicPath: config.output.publicPath,
  contentBase: 'src',
  stats: {
    colors: true,
    hash: false,
    timings: true,
    chunks: false,
    chunkModules: false,
    modules: false
  }
});

app.use(middleware);
app.use(webpackHotMiddleware(compiler));
app.get('*', function response(req, res) {
  res.write(middleware.fileSystem.readFileSync(path.join(__dirname, 'dist/index.html')));
  res.end();
});
// }

// else {
//   app.use(express.static(__dirname + '/dist'));
//   app.get('*', function response(req, res) {
//     res.sendFile(path.join(__dirname, 'dist/index.html'));
//   });
// }

io.on('connection', function(socket) {
  socket.on('chat message', (chatObj) => {

    // Get a reply from API.AI
    var options = {
      sessionId: '12345'
    };

    var apiaiReq;
    apiaiReq = apiai.textRequest(chatObj.msg, options);

    apiaiReq.on('response', (response) => {
      let aiText = response.result.fulfillment.speech;
      socket.emit('bot reply', response); // Send the result back to the browser!
    });

    apiaiReq.on('error', (error) => {
      console.log(error);
    });

    apiaiReq.end();

  });
});

server.listen(port, function onStart(err) {
  if (err) {
    console.log(err);
  }
  console.info('==> 🌎 Listening on port %s. Open up http://127.0.0.1:%s/ in your browser.', port, port);
});
