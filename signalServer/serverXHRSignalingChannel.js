// Copyright 2013-2014 Digital Codex LLC
// You may use this code for your own education.  If you use it
// largely intact, or develop something from it, don't claim
// that your code came first.  You are using this code completely
// at your own risk.  If you rely on it to work in any particular
// way, you're an idiot and we won't be held responsible.

var log = require("./log").log;

var connections = {},
    partner = {},
    messagesFor = {};

// queue the sending of a json response
function webrtcResponse(response, res) {
  log("replying with webrtc response " +
      JSON.stringify(response));
  res.writeHead(200, {"Content-Type":"application/json"});
  res.write(JSON.stringify(response));
  res.end();
}


// send an error as the json WebRTC response
function webrtcError(err, res) {
  log("replying with webrtc error:  " + err);
  webrtcResponse({"err": err}, res);
}


// handle XML HTTP Request to connect using a given key
function connect(info) {
  var res = info.res;
  res.setHeader("Access-Control-Allow-Origin", "*");
  var query = info.query,
      thisconnection,
      newID = function() {
        // create large random number unlikely to be repeated
        // soon in server's lifetime
        return Math.floor(Math.random()*1000000000);
      },
      connectFirstParty = function() {
        if (thisconnection.status == "connected") {
          // delete pairing and any stored messages
          delete partner[thisconnection.ids[0]];
          delete partner[thisconnection.ids[1]];
          delete messagesFor[thisconnection.ids[0]];
          delete messagesFor[thisconnection.ids[1]];
        }
        connections[query.key] = {};
        thisconnection = connections[query.key];
        thisconnection.status = "waiting";
        thisconnection.ids = [newID()];
        webrtcResponse({"id":thisconnection.ids[0],
                        "status":thisconnection.status,"pollId":thisconnection.ids[0]}, res);
      },
      connectSecondParty = function() {
        thisconnection.ids[1] = newID();
        partner[thisconnection.ids[0]] = thisconnection.ids[1];
        partner[thisconnection.ids[1]] = thisconnection.ids[0];
        messagesFor[thisconnection.ids[0]] = [];
        messagesFor[thisconnection.ids[1]] = [];
        thisconnection.status = "connected";
        webrtcResponse({"id":thisconnection.ids[1],
                        "status":thisconnection.status}, res);
      };

  log("Request handler 'connect' was called.");
  if (query && query.key) {
    var thisconnection = connections[query.key] ||
                         {status:"new"};
    if (thisconnection.status == "waiting") { // first half ready
      connectSecondParty(); return;
    } else { // must be new or status of "connected"
      connectFirstParty(); return;
    }
  } else {
    webrtcError("No recognizable query key", res);
  }
}
exports.connect = connect;


// Queues message in info.postData.message for sending to the
// partner of the id in info.postData.id
function sendMessage(info) {
  log("postData received is ***" + info.postData + "***");
  var postData = JSON.parse(info.postData),
      res = info.res;
  //So polling peer can distinguish peers, include pollId
  postData.message.pollId = partner[postData.id];
  res.setHeader("Access-Control-Allow-Origin", "*"); //Allow CORS

  if (typeof postData === "undefined") {
    webrtcError("No posted data in JSON format!", res);
    return;
  }
  if (typeof (postData.message) === "undefined") {
    webrtcError("No message received", res);
    return;
  }
  if (typeof (postData.id) === "undefined") {
    webrtcError("No id received with message", res);
    return;
  }
  if (typeof (partner[postData.id]) === "undefined") {
    webrtcError("Invalid id " + postData.id, res);
    return;
  }
  if (typeof (messagesFor[partner[postData.id]]) ===
              "undefined") {
    webrtcError("Invalid id " + postData.id, res);
    return;
  }
  debugger;
  messagesFor[partner[postData.id]].push(postData.message);
  log("Saving message ***" + postData.message +
      "*** for delivery to id " + partner[postData.id]);
  webrtcResponse("Saving message ***" + postData.message +
                 "*** for delivery to id " +
                 partner[postData.id], res);
}
exports.send = sendMessage;


// Returns all messages queued for info.postData.id
function getMessages(info) {
  var postData = JSON.parse(info.postData),
      res = info.res;
  res.setHeader("Access-Control-Allow-Origin", "*"); //Allow CORS

  if (typeof postData === "undefined") {
    webrtcError("No posted data in JSON format!", res);
    return;
  }
  if (typeof (postData.id) === "undefined") {
    webrtcError("No id received on get", res);
    return;
  }
  if (typeof (messagesFor[postData.id]) === "undefined") {
    webrtcError("Invalid id " + postData.id, res);
    return;
  }

  log("Sending messages ***" +
      JSON.stringify(messagesFor[postData.id]) + "*** to id " +
      postData.id);
  webrtcResponse({'msgs':messagesFor[postData.id], "pollId":postData.id}, res);
  messagesFor[postData.id] = [];
}
exports.get = getMessages;

