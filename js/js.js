(function() {

//UI handels
var connectPeerButton = null;
var peerKey = null;

//Peer connections
    /* Structure of peer connections:
     *
     * localConnections is an array of peer IDs & RTCPeerConnection objects
    */
var localConnections = null; //RTCPeerConnections for local RTCPeerConnection objects
var remoteConnections = null;//RTCPeerConnections for remote RTCPeerConnections objects

var sendChannels = null; // RTCDataChannels for the local (senders)
var receiveChannels = null; // RTCDataChannel for the remote (receivers)
var config = null; //RTCConfiguration https://developer.mozilla.org/en-US/docs/Web/API/RTCConfiguration
    window.addEventListener('load', startup, false);
})()

function startup() {
    /* Startup() - Initial Setup & connect event listeners. */
    console.log("Starting up...");
    connectPeerButton = document.getElementById('connectPeer');
    localConnections = []; //Array of local RTCPeerConnections
    config = {iceServers:new Array()};
    config.iceServers.push({"url":"turn:178.62.83.184:3478","username":"my_username","credential":"my_password"});

    //Event listeners for UI actions
    connectPeerButton.addEventListener('click', connect , false);

    function connect() {
    /* connect() - Connect to signaling server, sending peerKey
    *  to establih signalling connection to exachane ICE candiates
    *  over.
    */
	console.log("Connect() called - Lets create a signaling channel!");
	var peerKey = document.getElementById('peerKey').value;
	localConnections.push(
			{
			peerKey: peerKey,
			connection: new RTCPeerConnection(config)
			});
	//Create peers data channel and establish its event listeners
	var peerIndex = localConnections.length - 1;
	// On ice candidate handler
	localConnections[peerIndex].connection.onicecandidate = sendIceCandidateToSignalServer;
	//Add datachannel to peers RTCPeerConnection
	localConnections[peerIndex].sendChannel = localConnections[peerIndex].connection.createDataChannel("sendChannel");
	localConnections[peerIndex].sendChannel.onopen = handleSendChannelStatusChange;
	localConnections[peerIndex].sendChannel.onmessage = handleReceiveMessage;
	localConnections[peerIndex].sendChannel.ondatachannel = receiveChannelCallback = function() {alert('receiveChannelCallback');}; //TODO should only do if we waited.
	localConnections[peerIndex].sendChannel.onclose = handleSendChannelStatusChange;

	  var errorCB, scHandlers, handleMsg;
      var key = document.getElementById('peerKey').value;

	  // This is the handler for all messages received on the
	  // signaling channel.
	  handleMsg = function (msg) {
		// First, we clean up the message and post it on-screen
		var msgString = JSON.stringify(msg).replace(/\\r\\n/g,'\n');
		console.log("Message from signal server:");
		console.log(msg);
		// Then, we take action based on the kind of message
		if (msg.type === "offer") {
		  localConnections[peerIndex].connection.setRemoteDescription(new RTCSessionDescription(msg,
							function(){console.log("Sucess setRemoteDescription offer on connect()..");},
							function(){console.log("Failed setRemoteDescription offer on connect()...");}));
		  //Answer offer from remote peer
		  localConnections[peerIndex].connection.createAnswer()
		  .then(function(answer){
			sendIceAnswerToSignalServer(answer, function(){console.log("In sendIceAnswerToSignalServer Sending answer to an offer received.");});
			//Set local description for this peer (the remote connecting peer)
			localConnections[peerIndex].connection.setLocalDescription(answer);
		  });
		  //answer();
		} else if (msg.type === "answer") {
		  localConnections[peerIndex].connection.setRemoteDescription(new RTCSessionDescription(msg,
							function(){console.log("Sucess setRemoteDescription answer on connect..");},
							function(){console.log("Failed setRemoteDescription answer on connect...");}));
		} else if (msg.type === "candidate") {
		  localConnections[peerIndex].connection.addIceCandidate(
			new RTCIceCandidate({sdpMLineIndex:msg.mlineindex,
								 candidate:msg.candidate}),
					function(){console.log("Add iceCandidate sucess on connect() call..");},
					function(){console.log("error accing iceCanditation on connect() call..");});
		}
	  };
	  // handlers for signaling channel
	  scHandlers = {
		'onWaiting' : function () {
		  console.log("Status: Waiting");
		  // weWaited will be used for auto-call
		  weWaited = true;
		},
		'onConnected': function () {
		  console.log("Status: Connected");
		  // set up the RTC Peer Connection since we're connected
		  //createPC();
		  connectPeers(peerIndex);
		},
		'onMessage': handleMsg
	  };

	  // Finally, create signaling channel
	  signalingChannel = createSignalingChannel(key, scHandlers);
	  errorCB = function (msg) {
		console.error("Error was: " + msg);
	  };

	  // and connect.
	  signalingChannel.connect(errorCB);
    }//End connect()


    function connectPeers(peerIndex) {
    /* connectPeers() -Connect local peer to remote using signal server as boot peer 
    *  Called after both peers have established they are both connected to the signaling
    *  channel createdby calling connect()
    */
        var peerKey = document.getElementById('peerKey').value;
		console.log("Did we wait???");
        // Create an offer to connect (if we waited); this starts the process
		if ( weWaited ) 
		{
			localConnections[peerIndex].connection.createOffer()
			.then(function(offer)
				{
					localConnections[peerIndex].connection.setLocalDescription(offer);
			}).then(function(){
					sendIceOfferToSignalServer({peerKey:peerKey, candidate:localConnections[peerIndex].connection.localDescription}, function(){console.log("sent offer");});
			}).then(function (){
					console.log('Should now pollsignal server asking for remote peer\'s answer after it calls createAnswer(). peerKey: ' + peerKey);
			}).catch(handleCreateDescriptionError);

			function handleCreateDescriptionError(error) {
				console.log("Unable to create an offer: " + error.toString());
			}
		} else {
			console.log("We didn't wait, so we'll be sending an answer at some point.");
		}

    }//End connectPeers()

}//End startup()

function handleSendChannelStatusChange(event) {
    console.log("In handleSendChannelStatusChange() event was:");
	console.log(event);
}// end handleSendChannelStatusChange()


function sendIceOfferToSignalServer(msg, responseHandler) {
    console.log("In sendIceOfferToSignalServer(msg), msg is:");
    console.log(msg);
    console.log("Should send that^ to the signaling server so remote peer can grab it.");

    var reponseHandler = responseHandler || function() {};
    //open XHR and send connection information to signaling server with peerKey as ID
    var client = new XMLHttpRequest(); 
    client.onreadystatechange = handler;
    //client.open("POST","http://localhost:5001/send");
    client.open("POST","http://localhost:5001/send");
    var sendData = {"id":window.id, 
                    "message":msg.candidate
                   };
    client.send(JSON.stringify(sendData));
    function handler() {
        console.log('In handler() for response from signaling server after sending Offer.');
        if(this.readyState == this.DONE) {
            if(this.status == 200 && this.response != null) {
                var res = JSON.parse(this.response);
                if (res.err) {
                    console.error(res.err);
                    return;
                }
                console.log("Response from signal server was: " + res.status);
            }
        }
    }//End handler();
}//End sendIceOfferToSignalServer(msg)

function sendIceAnswerToSignalServer(msg, responseHandler) {
    console.log("In sendIceAnswerToSignalServer (msg), msg is:");
    console.log(msg);
    console.log("Should send that^ to the signaling server so remote peer can grab it.");

    var reponseHandler = responseHandler || function() {};
    //open XHR and send connection information to signaling server with peerKey as ID
    var client = new XMLHttpRequest(); 
    client.onreadystatechange = handler;
    //client.open("POST","http://localhost:5001/send");
    client.open("POST","http://localhost:5001/send");
    var sendData = {"id":window.id, 
                    "message":msg
                   };
    client.send(JSON.stringify(sendData));
    function handler() {
        console.log('In handler() for response from signaling server after sending Answer.');
        if(this.readyState == this.DONE) {
            if(this.status == 200 && this.response != null) {
                var res = JSON.parse(this.response);
                if (res.err) {
                    console.error(res.err);
                    return;
                }
                console.log("Response from signal server was: " + res.status);
            }
        }
    }//End handler();
}//End sendIceAnswerToSignalServer(msg)


function sendIceCandidateToSignalServer(msg, responseHandler) {
    console.log("In sendIceCandidateToSignalServer(msg), msg is:");
    console.log(msg);
    console.log("Should send that^ to the signaling server so remote peer can grab it.");

    var reponseHandler = responseHandler || function() {};
    //open XHR and send connection information to signaling server with peerKey as ID
    var client = new XMLHttpRequest(); 
    client.onreadystatechange = handler;
    //client.open("POST","http://localhost:5001/send");
    client.open("POST","http://localhost:5001/send");
    var sendData = {"id":window.id, 
                    "message":{
                        type:'candidate', 
                        mlineindex:msg.candidate.sdpMLineIndex,
                        candidate:msg.candidate.candidate}
                   };
    client.send(JSON.stringify(sendData));
    function handler() {
        console.log('In handler() for response from signaling server after sending Ice candidates.');
        if(this.readyState == this.DONE) {
            if(this.status == 200 && this.response != null) {
                var res = JSON.parse(this.response);
                if (res.err) {
                    console.error(res.err);
                    //return;
                }
                console.log("Response from signal server was: " + res.status);
            }
        }
    }//End handler();
}//End sendIceCandidateToSignalServer(msg)

function handleReceiveMessage(event) {
    var el = document.createElement("p");
    var txtNode = document.createTextNode(event.data);
    
    el.appendChild(txtNode);
    receiveBox.appendChild(el);
  }
