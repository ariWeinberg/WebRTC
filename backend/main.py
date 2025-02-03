from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import sqlite3
import bcrypt

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
socketio = SocketIO(app, cors_allowed_origins="*")  # Enable WebSocket support

logged_in_users = set()  # Store logged-in users
connections = {}  # Store WebRTC connection data

# Initialize SQLite database
def init_db():
    with sqlite3.connect("users.db") as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )''')

init_db()

# Register User
@app.route("/register", methods=["POST"])
def register():
    data = request.json
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    hashed_password = bcrypt.hashpw(password.encode(), bcrypt.gensalt())

    try:
        with sqlite3.connect("users.db") as conn:
            conn.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, hashed_password))
            conn.commit()
        return jsonify({"message": "User registered successfully"}), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username already exists"}), 400

# Login User
@app.route("/login", methods=["POST"])
def login():
    data = request.json
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    with sqlite3.connect("users.db") as conn:
        cursor = conn.execute("SELECT password FROM users WHERE username=?", (username,))
        user = cursor.fetchone()

    if user and bcrypt.checkpw(password.encode(), user[0]):
        logged_in_users.add(username)
        return jsonify({"message": "Login successful"}), 200
    else:
        return jsonify({"error": "Invalid credentials"}), 401

# Logout User
@app.route("/logout", methods=["POST"])
def logout():
    data = request.json
    username = data.get("username")
    if username in logged_in_users:
        logged_in_users.remove(username)
        return jsonify({"message": "Logout successful"}), 200
    return jsonify({"error": "User not logged in"}), 400

# Get Logged-in Users
@app.route("/logged-in-users", methods=["GET"])
def get_logged_in_users():
    return jsonify({"logged_in_users": list(logged_in_users)}), 200

# WebRTC Signaling Endpoints
@socketio.on("send_offer")
def handle_send_offer(data):
    receiver = data.get("receiver")
    print(f"Received send_offer event for {receiver}")  # Debug log
    connections[receiver] = {"offer": data.get("offer")}
    emit("receive_offer", {"sender": data.get("receiver"), "offer": data.get("offer")}, broadcast=True)

@socketio.on("send_answer")
def handle_send_answer(data):
    sender = data.get("sender")
    if sender in connections:
        connections[sender]["answer"] = data.get("answer")
    emit("receive_answer", data, broadcast=True)

@socketio.on("send_ice_candidate")
def handle_send_ice_candidate(data):
    target = data.get("target")
    if target in connections:
        if "ice_candidates" not in connections[target]:
            connections[target]["ice_candidates"] = []
        connections[target]["ice_candidates"].append(data.get("candidate"))
    emit("receive_ice_candidate", data, broadcast=True)

# WebRTC Call Signaling
@socketio.on("dial_user")
def handle_dial_user(data):
    caller = data.get("caller")
    receiver = data.get("receiver")

    print(f"Received dial_user event: {caller} -> {receiver}")  # Debug log

    if receiver in logged_in_users:
        print(f"Emitting incoming_call to: {receiver}")  # Debug log
        emit("incoming_call", {"caller": caller, "receiver": receiver}, broadcast=True)  # Make sure it's being sent
    else:
        print(f"Receiver {receiver} not found in logged_in_users")  # Debugging missing users

@socketio.on("call_accepted")
def handle_call_accepted(data):
    caller = data.get("caller")
    receiver = data.get("receiver")
    print(f"Received call_accepted event: {caller} -> {receiver}")
    emit("call_accepted", {"caller": caller, "receiver": receiver}, broadcast=True)

@socketio.on("call_declined")
def handle_call_declined(data):
    caller = data.get("caller")
    receiver = data.get("receiver")
    print(f"Received call_declined event: {caller} -> {receiver}")
    emit("call_declined", {"caller": caller, "receiver": receiver}, broadcast=True)

if __name__ == "__main__":
    socketio.run(app, port=12000, debug=True)
