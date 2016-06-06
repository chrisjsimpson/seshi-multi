// Copyright 2013-2014 Digital Codex LLC
// You may use this code for your own education.  If you use it
// largely intact, or develop something from it, don't claim
// that your code came first.  You are using this code completely
// at your own risk.  If you rely on it to work in any particular
// way, you're an idiot and we won't be held responsible.

var server = require("./server");
var requestHandlers = require("./serverXHRSignalingChannel");
var log = require("./log").log;
var port = process.argv[2] || 5001;


// returns 404
function fourohfour(info) {
  var res = info.res;
  log("Request handler fourohfour was called.");
  res.writeHead(404, {"Content-Type": "text/plain"});
  res.write("404 Page Not Found");
  res.end();
}

var handle = {};
handle["/"] = fourohfour;
handle["/connect"] = requestHandlers.connect;
handle["/send"] = requestHandlers.send;
handle["/get"] = requestHandlers.get;

server.serveFilePath("static");
server.start(handle, port);

