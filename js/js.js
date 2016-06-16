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

var sendChannels = null; // RTCDataChannels for the local (senders)
var receiveChannels = null; // RTCDataChannel for the remote (receivers)
var config = null; //RTCConfiguration https://developer.mozilla.org/en-US/docs/Web/API/RTCConfiguration
window.addEventListener('load', startup, false);

})()

function startup() {
    /* Startup() - Initial Setup & connect event listeners. */
    console.log("Starting up...");
    peerIdentity = Math.random() * (99999999999999999999 - 0) + 0;
    connectPeerButton = document.getElementById('connectPeer');
    localConnections = []; //Array of local RTCPeerConnections
    config = {iceServers:new Array()};
    config.iceServers.push({"url":"turn:178.62.83.184:3478","username":"my_username","credential":"my_password"});

    //Event listeners for UI actions
    connectPeerButton.addEventListener('click', connect , false);

    function connect() 
    {
        /* connect() - Connect to signaling server, sending peerKey
        *  to establih signalling connection to exachane ICE candiates
        *  over.
        */
        console.log("Connect() called - Lets create a signaling channel!");
        var peerKey = document.getElementById('peerKey').value;
        localConnections.push(
                {
                peerKey: peerKey,
                peerIdentity: peerIdentity,
                rtcConnection: new RTCPeerConnection(config),
                isSdpSent:false
                });
        //Create peers data channel and establish its event listeners
        var peerIndex = localConnections.length - 1;
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
            console.log("Received an offer");
              answerOffer(msg);
            } else if (msg.type === "answer") {
              console.log("Received an answer");
              saveAnswer(msg); 
            } else if (msg.type === "candidate") {
              console.log("Received a candidate");
            }
        };

        // handlers for signaling channel
        scHandlers = {
            'onWaiting' : function () {
                console.log("Status: Waiting");
                // weWaited will be used for auto-call
                localConnections[peerIndex].weWaited = true;
            },
            'onConnected': function () {
                console.log("Status: Connected");
                // set up the RTC Peer Connection since we're connected
                if (localConnections[peerIndex].weWaited === undefined ) 
                {
                    localConnections[peerIndex].weWaited = false;
                }
                connectPeers(peerIndex);
            },
            'onMessage': handleMsg
        };

        // Finally, create signaling channel
        localConnections[peerIndex].signalingChannel = createSignalingChannel(key, scHandlers);
        errorCB = function (msg) {
            console.error("Error was: " + msg);
        };
        // and connect.
        localConnections[peerIndex].signalingChannel.connect(errorCB, peerIndex);
    }//End connect()

}//End startup()


function sendIceOfferToSignalServer(msg, pollId, responseHandler) {
    console.log("In sendIceOfferToSignalServer(msg), msg is:");
    console.log(msg);
    console.log("Should send that^ to the signaling server so remote peer can grab it.");

    var reponseHandler = responseHandler || function() {};
    //open XHR and send connection information to signaling server with peerKey as ID
    var client = new XMLHttpRequest(); 
    client.onreadystatechange = handler;
    client.open("POST", host + "send");
    var sendData = {"id":pollId, 
                    "message":new RTCSessionDescription(msg)
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


function connectPeers(peerIndex) {
    if ( localConnections[peerIndex].weWaited == true )
    {
        caller();
    } else {
        recipient();
    }

    function caller() {
        //Create datachannel
        localConnections[peerIndex].sendChannel = localConnections[peerIndex].rtcConnection.createDataChannel("sendChannel");
        localConnections[peerIndex].sendChannel.onopen = handleReceiveChannelStatusChange;
        localConnections[peerIndex].sendChannel.onmessage = handleReceiveMessage;
        localConnections[peerIndex].sendChannel.onclose = handleReceiveChannelStatusChange

        localConnections[peerIndex].rtcConnection.onicecandidate = sendIceCandidates;
        //Create offer
        localConnections[peerIndex].rtcConnection.createOffer()
        .then(offer => localConnections[peerIndex].rtcConnection.setLocalDescription(offer))
        .catch(function(error){console.error("Error in caller: " + error);});

    }//End caller()

    function recipient() {
        //Receive datachannel
        localConnections[peerIndex].rtcConnection.ondatachannel = receivedDataChannel;
        function receivedDataChannel(event) {
            console.log(event);
            localConnections[peerIndex].sendChannel = event.channel;
            localConnections[peerIndex].sendChannel.onopen = handleReceiveChannelStatusChange;
            localConnections[peerIndex].sendChannel.onmessage = handleReceiveMessage;
            localConnections[peerIndex].sendChannel.onclose = handleReceiveChannelStatusChange
        }//End receivedDataChannel()
    }//End recipient()

}//End connectPeers()

function answerOffer(offer) {
    var peerIndex = getPeerIndexByPollId(offer.pollId);
    localConnections[peerIndex].rtcConnection.onicecandidate = sendIceCandidates;
    //Set remote description
    localConnections[peerIndex].rtcConnection.setRemoteDescription(offer)
    .then(() => localConnections[peerIndex].rtcConnection.createAnswer())
    .then(answer => localConnections[peerIndex].rtcConnection.setLocalDescription(answer)) 
    .catch(function(error){console.error("Error in answer()" + error);});//setLocalDescription (above, should wait until sendIceCandidates is complete)

}//End answerOffer

function saveAnswer(answer) {
    var peerIndex = getPeerIndexByPollId(answer.pollId); //Double check we've not confused the partner ids here..
    localConnections[peerIndex].rtcConnection.setRemoteDescription(answer)
    .catch(function(error){console.error("Error in saveAnswer" + error);});
}//End saveAnswer()

function sendIceCandidates(event) {
    console.log("Caller candidate:");
    console.log(event.candidate);
    var peerIndex = getPeerIndexByPollId(event.currentTarget.pollId);
    //Send caller's entire SDP collection to signal server (the callers localDescription)
    if ( localConnections[peerIndex].rtcConnection.iceGatheringState == 'complete')
    {
        if (localConnections[peerIndex].rtcConnection.iceGatheringState.isSdpSent) return;
        localConnections[peerIndex].rtcConnection.iceGatheringState.isSdpSent = true;
        console.log("Ready to send entire callers SDP to signal server."); 
        pollId = event.target.pollId;
        sendIceOfferToSignalServer(localConnections[peerIndex].rtcConnection.localDescription, pollId);
    }//End check iceGathering is complted before sending offer.
}//End sendIceCandidates()

function handleReceiveChannelStatusChange(event) {
    console.log(event);
    if (event.type == 'open') {
        var numPeersElm = document.getElementById('numConnectedPeers');
        numPeersElm.textContent = parseInt(numPeersElm.textContent) + 1;
    }
};//End handleReceiveChannelStatusChange()
function handleReceiveMessage(event) {console.log(event);};

function getPeerIndexByPollId(pollId){
    for (var i=0; i< localConnections.length; i++) {
    if ( localConnections[i].rtcConnection.pollId == pollId )
    return i;
    }
}//End getPeerIndexByPollId(pollId)

function listConnections() {
	if (localConnections.length == 0)
	return console.log("There are zero connections.");
	for (var i=0; i<localConnections.length;i++)
	{
		if (localConnections[i].sendChannel == undefined) {
			datachannelState = '(Datachannel not created yet.)';
		} else {
			datachannelState = localConnections[i].sendChannel.readyState; 
		}
		console.log( i + '# ' + 
			'Peer identity: "' +  localConnections[i].peerIdentity + '"' +
			' Connection state: "' + datachannelState + '"' + 
		' Key used: "' + localConnections[i].peerKey + '"');
	}
}//End listConnectedPeers
