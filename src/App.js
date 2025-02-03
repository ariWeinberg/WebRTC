import { useState } from "react";
import { io } from "socket.io-client";
import Login from "./components/Login";
import Register from "./components/Register";
import Users from "./components/Users";
import VideoChat from "./components/VideoChat";

const socket = io("http://localhost:12000");

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(null);

  return (
    <div className="p-4 space-y-4">
      {!authenticated ? (
        <div>
          {isRegistering ? (
            <Register setAuthenticated={setAuthenticated} setLoggedInUser={setLoggedInUser} socket={socket} />
          ) : (
            <Login setAuthenticated={setAuthenticated} setLoggedInUser={setLoggedInUser} socket={socket} />
          )}
          <button onClick={() => setIsRegistering(!isRegistering)} className="p-2 bg-gray-500 text-white rounded">
            {isRegistering ? "Switch to Login" : "Switch to Register"}
          </button>
        </div>
      ) : (
        <div>
          <Users socket={socket} loggedInUser={loggedInUser} />
          <VideoChat socket={socket} loggedInUser={loggedInUser} />
        </div>
      )}
    </div>
  );
}
