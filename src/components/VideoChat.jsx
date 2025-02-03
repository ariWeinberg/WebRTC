import { useState, useEffect, useRef } from "react";

export default function VideoChat({socket, loggedInUser}) {
  const [offer, setOffer] = useState("");
  const [iceCandidates, setIceCandidates] = useState([]);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  }));

  useEffect(() => {
    if (!socket) return;

    const handleReceiveOffer = (data) => {
      if (data.receiver === loggedInUser) {
        console.log("receive_offer event received:", data);
        socket.emit("send_answer", { sender: loggedInUser, answer: generateAnswer(data.offer) });
      }
    };

    const handleReceiveAnswer = (data) => {
      if (data.sender === loggedInUser) {
        console.log("receive_answer event received:", data);
        const remoteAnswer = JSON.parse(data.answer);
        peerConnection.current.setRemoteDescription(new RTCSessionDescription(remoteAnswer));
      }
    };

    const handleAcceptedCall = (data) => {
      if (data.receiver === loggedInUser && data.caller === loggedInUser) {
        console.log("Call accepted event received:", data);
        createOffer();
      }
    };

    socket.on("receive_offer", handleReceiveOffer);
    socket.on("receive_answer", handleReceiveAnswer);
    socket.on("call_accepted", handleAcceptedCall);
    return () => {
      socket.off("receive_offer", handleReceiveOffer);
      socket.off("receive_answer", handleReceiveAnswer);
      socket.off("call_accepted", handleAcceptedCall);
    };
  }, [socket, loggedInUser]);

  const startMedia = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideoRef.current.srcObject = stream;
    stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));

    peerConnection.current.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('New ICE candidate:', event.candidate);
        setIceCandidates(prev => [...prev, JSON.stringify(event.candidate)]);
      }
    };
  };

  const createOffer = async () => {
    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    console.log("Offer created:", offer);
    socket.emit("send_offer", { receiver: loggedInUser, offer });
  };

  const createAnswer = async () => {
    if (!offer) return;
    const remoteOffer = JSON.parse(offer);
    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(remoteOffer));
    const answer = await peerConnection.current.createAnswer();
    await peerConnection.current.setLocalDescription(answer);

    console.log("Answer created:", answer);
    socket.emit("send_answer", { sender: loggedInUser, answer });
  };

  const generateAnswer = async (_offer) => {
    if (!_offer) return;
    const remoteOffer = JSON.parse(_offer);
    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(remoteOffer));
    const answer = await peerConnection.current.createAnswer();
    await peerConnection.current.setLocalDescription(answer);

    console.log("Answer created:", answer);
    return JSON.stringify(answer);
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
