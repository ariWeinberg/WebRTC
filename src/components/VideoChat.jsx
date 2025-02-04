import { useState, useEffect, useRef } from "react";

export default function VideoChat({socket, loggedInUser}) {
  const [Gcallee, setGCallee] = useState(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    iceTransportPolicy: 'all'  // Ensures all candidates (relay and host) are considered
  }));
  

  useEffect(() => {
    if (!socket) return;


    const handleReceiveOffer = async (data) => {
        console.log("receive_offer event received:", data);
        socket.emit("send_answer", { "caller": data["caller"], "callee": data["callee"], answer: JSON.stringify(await generateAnswer(data)) });
        peerConnection.current.addIceCandidate(null)
    };

    const handleReceiveAnswer = (data) => {
        console.log("receive_answer event received:", data);
        if (!data.answer) {
          console.error("Received null or undefined answer:", data);
          return;
        }
        try {
          const remoteAnswer = JSON.parse(data.answer);
          if (!remoteAnswer.type || !remoteAnswer.sdp) {
            throw new Error("Invalid RTCSessionDescription format");
          }
          peerConnection.current.setRemoteDescription(new RTCSessionDescription(remoteAnswer));
          peerConnection.current.addIceCandidate(null)
        } catch (error) {
          console.error("Error parsing or setting remote description:", error, data.answer);
        }
    };

    const handleAcceptedCall = async (data) => {
      console.log("Call accepted event received:", data);
      const offer = await createOffer();
      console.log("Offer created and returned:", offer);
      socket.emit("send_offer", { "caller": data.caller, "callee": data.callee, "offer": offer });
      setGCallee(data.callee)
    };

    const handleReceiveIceCandidate = (data) => {
      console.log("Received ICE candidate:", data);
      if (data.candidate) {
          peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate))
              .then(() => console.log("ICE candidate added successfully"))
              .catch(error => console.error("Error adding ICE candidate:", error));
      } else {
          console.warn("Received ICE candidate is null or undefined.");
      }
  };
  

    socket.on("receive_offer", handleReceiveOffer);
    socket.on("receive_answer", handleReceiveAnswer);
    socket.on("call_accepted", handleAcceptedCall);
    socket.on("receive_ice_candidate", handleReceiveIceCandidate);

    peerConnection.current.onicecandidate = (event) => {
      console.log("ICE candidate event:", event);
      if (event.candidate && Gcallee) {
          console.log("Sending ICE candidate:", event.candidate);
          socket.emit("send_ice_candidate", { caller: loggedInUser, callee: Gcallee, candidate: event.candidate });
      } else {
          console.log("No ICE candidate generated.");
      }
  };
  
    return () => {
      socket.off("receive_offer", handleReceiveOffer);
      socket.off("receive_answer", handleReceiveAnswer);
      socket.off("call_accepted", handleAcceptedCall);
      socket.off("receive_ice_candidate", handleReceiveIceCandidate);
    };
  }, [socket, loggedInUser, Gcallee]);

  const startMedia = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    console.log("Media stream obtained:", stream);
    localVideoRef.current.srcObject = stream;
    stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));

    peerConnection.current.ontrack = (event) => {
        remoteVideoRef.current.srcObject = event.streams[0];
    };

    console.log("Tracks added to peer connection:", peerConnection.current.getSenders());
};


  const createOffer = async () => {
    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    console.log("Offer created:", offer);
    return JSON.stringify(offer);
  };

  const generateAnswer = async (_offer) => {
    try {
      console.log("Generating answer for offer:", _offer["offer"]);
      const remoteOffer = JSON.parse(_offer["offer"]);
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(remoteOffer));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      console.log("Answer created:", answer);
      return answer;
    } catch (error) {
      console.error("Error generating answer:", error);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Video Chat</h1>
      <button onClick={startMedia} className="p-2 bg-blue-500 text-white rounded">Start Camera</button>
      <div className="flex space-x-4">
        <video ref={localVideoRef} autoPlay playsInline className="w-1/2 border" />
        <video ref={remoteVideoRef} autoPlay playsInline className="w-1/2 border" />
      </div>
    </div>
  );
}
