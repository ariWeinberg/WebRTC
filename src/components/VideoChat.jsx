import { useState, useEffect, useRef } from "react";

export default function VideoChat({socket, loggedInUser}) {
  const [iceCandidates, setIceCandidates] = useState([]);
  const localVideoRef = useRef(null);
    const [remoteIceCandidate, setRemoteIceCandidate] = useState("");
    const remoteVideoRef = useRef(null);
  const peerConnection = useRef(new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  }));

  useEffect(() => {
    if (!socket) return;

    const handleReceiveOffer = async (data) => {
        console.log("receive_offer event received:", data);
        socket.emit("send_answer", { "caller": data["caller"], "callee": data["callee"], answer: JSON.stringify( await generateAnswer(data)) });
    };

    const handleReceiveAnswer = (data) => {
        console.log("receive_answer event received:", data);

        if (!data.answer) {
          console.error("Received null or undefined answer:", data);
          return;
        }

        let remoteAnswer;
        try {
          remoteAnswer = JSON.parse(data.answer);
          if (!remoteAnswer.type || !remoteAnswer.sdp) {
            throw new Error("Invalid RTCSessionDescription format");
          }
          peerConnection.current.setRemoteDescription(new RTCSessionDescription(remoteAnswer));
        } catch (error) {
          console.error("Error parsing or setting remote description:", error, data.answer);
        }


    };

    const handleAcceptedCall = async (data) => {
        console.log("Call accepted event received:", data);
        let _offer = await createOffer();
        console.log("Offer created and returned:" + _offer);
        await socket.emit("send_offer", { "caller": data.caller, "callee": data.callee, "offer": _offer});
    };

    const handleLocalIceCandidate = (event) => {
        if (event.candidate) {
            console.log('New ICE candidate:', event.candidate);
            socket.emit("send_ice_candidate", { "callee": loggedInUser, "candidate": JSON.stringify(event.candidate) });
        } else {
            console.log('All ICE candidates have been gathered.');
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
        } else {
        console.log('All ICE candidates have been gathered.');
        }
    };
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
    var answer = await peerConnection.current.createAnswer();
    await peerConnection.current.setLocalDescription(answer);
    }
    catch (error) {
      console.error("Error generating answer:", error);
    }
    console.log("Answer created:", answer);
    return answer;
  };
  const addIceCandidate = async () => {
    if (!remoteIceCandidate) {
        alert("Please paste a valid ICE candidate before adding it.");
        return;
    }
    try {
        const candidates = remoteIceCandidate.trim().split('\n').map(line => JSON.parse(line));
        for (const candidate of candidates) {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
        alert("ICE candidates added successfully.");
    } catch (error) {
        alert("Invalid ICE candidate format. Ensure each candidate is a valid minified JSON without extra spaces.");
    }
    };
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Video Chat</h1>
      <button onClick={startMedia} className="p-2 bg-blue-500 text-white rounded">Start Camera</button>
      <div className="flex space-x-4">
        <video ref={localVideoRef} autoPlay playsInline className="w-1/2 border" />
        <video ref={remoteVideoRef} autoPlay playsInline className="w-1/2 border" />

        <textarea value={iceCandidates.join('\n')} readOnly className="w-full p-2 border" placeholder="Generated ICE Candidates" />
        <textarea onChange={(e) => setRemoteIceCandidate(e.target.value)} placeholder="Paste ICE Candidate Here" className="w-full p-2 border" />
        <button onClick={addIceCandidate} className="p-2 bg-red-500 text-white rounded">Add ICE Candidate</button>
      </div>
    </div>
  );
}
