from flask import Flask, request, jsonify
from colorama import Fore, Style
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import sqlite3
import bcrypt

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
socketio = SocketIO(app, cors_allowed_origins="*")  # Enable WebSocket support

logged_in_users = set()  # Store logged-in users
connections = {}  # Store WebRTC connection data
user_connections = {}  # Store user connections

# Initialize SQLite database
def init_db():
    with sqlite3.connect("users.db") as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )''')

init_db()


def emit_to_user(user_id, event, data, *args, **nargs):
    if user_id in user_connections:
        # print(f"Emitting {event} to {user_id} | Data: {data}")  # Debug log
        emit(event, data, to=user_connections[user_id], *args, **nargs)
    else:
        print(f"User {user_id} not found in user_connections")

def get_username_from_sid(sid):
    for username, user_sid in user_connections.items():
        if user_sid == sid:
            return username
    return None


def log_event(sender, recipient, event_type, data, sid, *args, **kwargs):
    event_direction = 0
    if sender == get_username_from_sid(request.sid):
        event_direction = 1
    elif recipient == get_username_from_sid(request.sid):
        event_direction = 2


    max_length = 25

    full_sender = str(sender)
    full_recipient = str(recipient)
    full_event_type = str(event_type)
    full_data = str(data)
    full_sid = str(sid)
    full_args = str(args)
    full_kwargs = str(kwargs)


    sender = str(sender)[0:max_length] + ("..." if len(str(sender)) > max_length else "")
    recipient = str(recipient)[0:max_length] + ("..." if len(str(recipient)) > max_length else "")
    event_type = str(event_type)[0:max_length] + ("..." if len(str(event_type)) > max_length else "")
    data = str(data)[0:max_length] + ("..." if len(str(data)) > max_length else "")
    sid = str(sid)[0:max_length] + ("..." if len(str(sid)) > max_length else "")
    args = str(args)[0:max_length] + ("..." if len(str(args)) > max_length else "")
    kwargs = str(kwargs)[0:max_length] + ("..." if len(str(kwargs)) > max_length else "")

    print(f"{Fore.LIGHTCYAN_EX} Received a{Style.RESET_ALL} {Fore.YELLOW}{event_type}{Style.RESET_ALL}{Fore.LIGHTCYAN_EX} event{Style.RESET_ALL} | \
{Fore.LIGHTCYAN_EX}call direction:{Style.RESET_ALL} {Fore.GREEN}{sender} -> {recipient}{Style.RESET_ALL} | \
{Fore.LIGHTCYAN_EX}event direction:{Style.RESET_ALL} {Fore.GREEN}{sender} {(event_direction == 1 and '->') or (event_direction == 2 and '<-') or 'Unknown'} {recipient}{Style.RESET_ALL} | \
{Fore.LIGHTCYAN_EX}SID:{Style.RESET_ALL} {Fore.GREEN}{sid}{Style.RESET_ALL} | \
{Fore.LIGHTCYAN_EX}Data:{Style.RESET_ALL} {Fore.GREEN}{data}{Style.RESET_ALL} | \
{Fore.LIGHTCYAN_EX}Args:{Style.RESET_ALL}{Fore.GREEN} {args}{Style.RESET_ALL} | \
{Fore.LIGHTCYAN_EX}KaArgs:{Style.RESET_ALL}{Fore.GREEN} {kwargs}{Style.RESET_ALL}")  # Debug log



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
def handle_send_offer(data, *args, **kwargs):
    callee = data.get("callee")
    caller = data.get("caller")
    # print(f"Received send_offer event | sender: {get_username_from_sid(request.sid)} | Data: {data}")  # Debug log

    log_event(caller, callee, "send_offer", data, request.sid, *args, **kwargs)

    connections[callee] = {"offer": data.get("offer")}
    emit_to_user(callee, "receive_offer", {"caller": data.get("caller"), "callee": data.get("callee"), "offer": data.get("offer")}, broadcast=True)

@socketio.on("send_answer")
def handle_send_answer(data, *args, **kwargs):
    # print(f"Received send_answer event | sender: {get_username_from_sid(request.sid)} | Data: {data}")  # Debug log
    caller = data.get("caller")
    callee = data.get("callee")
    log_event(caller, callee, "send_answer", data, request.sid, *args, **kwargs)
    if caller in connections:
        connections[caller]["answer"] = data.get("answer")
    emit_to_user(caller, "receive_answer", data, broadcast=True)

# WebRTC Call Signaling
@socketio.on("dial_user")
def handle_dial_user(data, *args, **kwargs):
    caller = data.get("caller")
    callee = data.get("callee")

    log_event(caller, callee, "dial_user", data, request.sid, *args, **kwargs)

    if callee in logged_in_users:
        print(f"Emitting incoming_call to: {callee}")  # Debug log
        emit_to_user(callee, "incoming_call", {"caller": caller, "callee": callee})
    else:
        print(f"Receiver {callee} not found in logged_in_users")

@socketio.on("call_accepted")
def handle_call_accepted(data, *args, **kwargs):
    caller = data.get("caller")
    callee = data.get("callee")
    
    log_event(caller, callee, "call_accepted", data, request.sid, *args, **kwargs)
    emit_to_user(caller, "call_accepted", {"caller": caller, "callee": callee}, broadcast=True)

@socketio.on("call_declined")
def handle_call_declined(data, *args, **kwargs):
    caller = data.get("caller")
    receiver = data.get("receiver")
    # print(f"Received call_declined event: {caller} -> {receiver}")
    log_event(caller, receiver, "call_declined", data, request.sid, *args, **kwargs)
    emit_to_user(caller, "call_declined", {"caller": caller, "receiver": receiver}, broadcast=True)

@socketio.on("send_ice_candidate")
def handle_send_ice_candidate(data, *args, **kwargs):
    callee = data.get("callee")
    #print(f"sending ICE candidate {get_username_from_sid(request.sid)} -> {callee} | Data: {data}")
    log_event(get_username_from_sid(request.sid), callee, "send_ice_candidate", data, request.sid, *args, **kwargs)
    emit_to_user(callee, "receive_ice_candidate", data)

@socketio.on("user_connected")
def handle_connect(data, *args, **kwargs):
    username = data.get("username")
    print(f"Client connected: {request.sid}: username: {username}")  # Debug log
    user_connections[username] = request.sid
    print(f"User connections updated: {user_connections}")  # Debug log

if __name__ == "__main__":
    socketio.run(app, port=12000, debug=True)
