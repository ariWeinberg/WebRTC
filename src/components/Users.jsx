import { useEffect, useState } from "react";

export default function Users({ socket, loggedInUser }) {
  const [users, setUsers] = useState([]);
  const [incomingCall, setIncomingCall] = useState(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch("http://localhost:12000/logged-in-users");
        const data = await response.json();
        setUsers(data.logged_in_users || []);
      } catch (error) {
        console.error("Error fetching logged-in users:", error);
      }
    };

    fetchUsers();
    const interval = setInterval(fetchUsers, 10000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = (data) => {
      console.log("Incoming call event received:", data);
      if (data.receiver === loggedInUser) {
        setIncomingCall(data);
      }
    };

    socket.on("incoming_call", handleIncomingCall);
    return () => socket.off("incoming_call", handleIncomingCall);
  }, [socket, loggedInUser]);

  const handleDial = (user) => {
    if (!loggedInUser) {
      alert("User not logged in");
      return;
    }
    socket.emit("dial_user", { caller: loggedInUser, receiver: user });
  };

  const handleAcceptCall = () => {
    if (incomingCall) {
      socket.emit("call_accepted", { caller: incomingCall.caller, receiver: incomingCall.receiver });
      setIncomingCall(null);

      // Start WebRTC process (offer -> answer -> ICE candidates)
      socket.emit("send_offer", { receiver: incomingCall.caller });
    }
  };

  return (
    <div className="p-4 space-y-4 border rounded shadow">
      <h2 className="text-lg font-bold">Logged-in Users</h2>
      <ul className="list-disc pl-4">
        {users.length > 0 ? (
          users.map((user, index) => (
            <li key={index} className="flex justify-between items-center">
              {user}
              <button
                onClick={() => handleDial(user)}
                className="ml-4 p-2 bg-blue-500 text-white rounded"
              >
                Dial
              </button>
            </li>
          ))
        ) : (
          <p>No users currently online</p>
        )}
      </ul>

      {incomingCall && (
        <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <h2 className="text-lg font-bold">Incoming Call</h2>
            <p>{incomingCall.caller} is calling you.</p>
            <div className="flex justify-center mt-4 space-x-4">
              <button
                onClick={handleAcceptCall}
                className="p-2 bg-green-500 text-white rounded"
              >
                Accept
              </button>
              <button
                onClick={() => {
                  socket.emit("call_declined", { caller: incomingCall.caller, receiver: incomingCall.receiver });
                  setIncomingCall(null);
                }}
                className="p-2 bg-red-500 text-white rounded"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
