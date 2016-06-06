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
    connectPeerButton.addEventListener('click', connectPeers, false);

    function connect() {
    /* connect() - Connect to signaling server, sending peerKey
    *  to establih signalling connection to exachane ICE candiates
    *  over.
    */

    }//End connect()


    function connectPeers() {
    /* connectPeers() -Connect local peer to remote using signal server as boot peer 
    *  Called after both peers have established they are both connected to the signaling
    *  channel createdby calling connect()
    */
        var peerKey = document.getElementById('peerKey').value;
        localConnections.push(
                {
                peerKey: peerKey,
                connection: new RTCPeerConnection(config)
                });
        //Create peers data channel and establish its event listeners
        var peerIndex = localConnections.length - 1;
        //Add datachannel to peers RTCPeerConnection
        localConnections[peerIndex].sendChannel = localConnections[peerIndex].connection.createDataChannel("sendChannel");
        localConnections[peerIndex].sendChannel.onopen = handleSendChannelStatusChange;
        localConnections[peerIndex].sendChannel.onclose = handleSendChannelStatusChange;

        var signalServerResponseHandler = function(res) { 
                                            console.log("Response from signal server:");
                                            console.log(res);}

        // Set up the ICE candidates
        localConnections[peerIndex].connection.onicecandidate = e => !e.candidate
            || sendIceCandidateToSignalServer({peerKey:peerKey,candidate:e}, signalServerResponseHandler)

        // Create an offer to connect; this starts the process
        localConnections[peerIndex].connection.createOffer()
        .then(offer => localConnections[peerIndex].connection.setLocalDescription(offer))
        .then(() => sendIceCandidateToSignalServer({peerKey:peerKey, candidate:localConnections[peerIndex].connection.localDescription}), signalServerResponseHandler)
        .then(() => console.log('Should now pollsignal server asking for remote peer\'s answer after it calls createAnswer(). peerKey: ' + peerKey))
        .then(answer => console.log('Remote peer should call setLocalDescription(answer)'))
        .then(() => console.log('Local peer (having polled signal server for it) it should call setRemoteDescription on its local RTC object'))
        .catch(handleCreateDescriptionError);

        function handleCreateDescriptionError(error) {
            console.log("Unable to create an offer: " + error.toString());
        }

    }//End connectPeers()

}//End startup()

function handleSendChannelStatusChange(event) {
    console.log("In handleSendChannelStatusChange()");
}// end handleSendChannelStatusChange()

function sendIceCandidateToSignalServer(msg, responseHandler) {
    console.log("In sendIceCandidateToSignalServer(msg), msg is:");
    console.log(msg);
    console.log("Should send that^ to the signaling server so remote peer can grab it.");

    var reponseHandler = responseHandler || function() {};
    //open XHR and send connection information to signaling server with peerKey as ID
    var client = new XMLHttpRequest(); 
    client.onreadystatechange = handler;
    client.open("POST","http://localhost:5001/send");
    var sendData = {"id":msg.peerKey, 
                    "message":{
                        type:'candidate', 
                        mlineindex:msg.candidate.candidate.sdpMLineIndex,
                        candidate:msg.candidate.candidate.candidate}
                   };
    client.send(JSON.stringify(sendData));
    function handler() {
        console.log('In handler() for response from signaling server after sending Ice candidates.');
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
}//End sendIceCandidateToSignalServer(msg)
