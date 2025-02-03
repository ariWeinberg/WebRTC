import { useState } from "react";

export default function Register({ setAuthenticated, setLoggedInUser, socket }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  const handleRegister = async () => {
    setError(null);
    const response = await fetch("http://localhost:12000/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    if (response.ok) {
      setAuthenticated(true);
      setLoggedInUser(username);
      localStorage.setItem("username", username);
      socket.emit("user_connected", { username });
    } else {
      setError(data.error || "Registration failed");
    }
  };

  return (
    <div className="p-4 space-y-4 border rounded shadow">
      <h2 className="text-lg font-bold">Register</h2>
      {error && <p className="text-red-500">{error}</p>}
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="w-full p-2 border rounded"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full p-2 border rounded"
      />
      <button onClick={handleRegister} className="p-2 bg-blue-500 text-white rounded w-full">
        Register
      </button>
    </div>
  );
}
