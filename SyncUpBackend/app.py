# app.py
# Entry point for the SyncUp Flask backend
# Responsible for creating the Flask application, connecting extensions,
# registering route blueprints and starting the development server

from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from models import database

# Create the Flask application instance
syncup_app = Flask(__name__)

# Enable CORS so the React Native frontend can make requests to this server
# Without this, cross-origin requests from the mobile app would be blocked
CORS(syncup_app)

# --- Configuration ---
# SQLite database stored locally in a file called syncup.db
syncup_app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///syncup.db'

# Disable modification tracking as it is unnecessary and uses extra memory
syncup_app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Secret key used to sign JWT tokens - should be changed to a strong random
# string in production and stored as an environment variable, not hardcoded
syncup_app.config['JWT_SECRET_KEY'] = 'syncup-secret-key-change-in-production'

# --- Initialise Extensions ---
# Connects the database instance from models.py to Flask app
database.init_app(syncup_app)

# Initialise JWT manager to handle token creation and validation
jwt_manager = JWTManager(syncup_app)

# --- Register Blueprints ---
# Blueprints keep routes organised in separate files rather than one large file
# Each blueprint handles a specific area of functionality

from routes.auth import auth_blueprint
from routes.calendars import calendars_blueprint
from routes.events import events_blueprint


# Authentication routes e.g. /api/auth/register, /api/auth/login
syncup_app.register_blueprint(auth_blueprint, url_prefix='/api/auth')

# Calendar and event routes e.g. /api/calendars/, /api/calendars/1/events
syncup_app.register_blueprint(calendars_blueprint, url_prefix='/api/calendars')
syncup_app.register_blueprint(events_blueprint, url_prefix='/api/calendars')


# --- Health Check Routes ---
@syncup_app.route('/')
def home():
    """Basic route to confirm the server is running"""
    return jsonify({"message": "SyncUp backend is running"})


@syncup_app.route('/api/test')
def test_connection():
    """
    Test route used by the frontend to verify backend connectivity.
    Returns a success response if the server is reachable.
    """
    return jsonify({
        "status": "success",
        "data": "Backend connection verified"
    })


# --- Database Initialisation ---
# Creates all tables defined in models.py if they do not already exist
# This runs once when the app starts up
with syncup_app.app_context():
    database.create_all()


# --- Start Server ---
if __name__ == '__main__':
    syncup_app.run(
        debug=True,       # Enables auto-reload and detailed error messages
        host='0.0.0.0',   # Accepts connections from any device on the network
        port=8000         # Port 8000 used to avoid conflict with macOS AirPlay
    )