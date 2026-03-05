# routes/auth.py
# Handles user registration and login for the SyncUp application
# Registration creates a new user account and a default personal calendar
# Login verifies credentials and returns a JWT token for authenticated requests

from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token
from models import database, User, Calendar
import bcrypt

# Create a blueprint to group all authentication related routes
auth_blueprint = Blueprint('auth', __name__)


@auth_blueprint.route('/register', methods=['POST'])
def register_user():
    """
    Registers a new user account.
    Expects JSON body with username, email and password.
    On success, creates the user and a default personal calendar.
    Returns 201 on success, 400 if fields are missing, 409 if email already exists.
    """

    # Extract the JSON data sent from the frontend
    request_data = request.get_json()

    username = request_data.get('username')
    email = request_data.get('email')
    password = request_data.get('password')

    # Validate that all required fields are present
    if not username or not email or not password:
        return jsonify({
            "error": "Username, email and password are all required"
        }), 400

    # Check if an account with this email already exists
    # filter_by returns None if no match is found
    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        return jsonify({
            "error": "An account with this email already exists"
        }), 409

    # Hash the password using bcrypt before storing it
    # encode converts the string to bytes which bcrypt requires
    # gensalt generates a random salt to make each hash unique
    password_bytes = password.encode('utf-8')
    hashed_password = bcrypt.hashpw(password_bytes, bcrypt.gensalt())

    # Create the new user record
    # Store the hash as a string by decoding from bytes
    new_user = User(
        username=username,
        email=email,
        hashed_password=hashed_password.decode('utf-8')
    )

    # Add user to the session and flush to generate their user_id
    # flush() sends the INSERT to the database but does not commit yet
    # This is needed so we can use new_user.user_id for the calendar
    database.session.add(new_user)
    database.session.flush()

    # Every new user gets a default personal calendar created automatically
    # is_default=True means this calendar cannot be deleted
    default_calendar = Calendar(
        name='My Calendar',
        description='Your personal calendar',
        calendar_colour='#4A90E2',
        is_default=True,
        user_id=new_user.user_id
    )

    database.session.add(default_calendar)

    # Commit both the user and calendar to the database together
    # If either fails, neither is saved - keeps data consistent
    database.session.commit()

    return jsonify({"message": "Account created successfully"}), 201


@auth_blueprint.route('/login', methods=['POST'])
def login_user():
    """
    Logs in an existing user.
    Expects JSON body with email and password.
    Returns a JWT access token and basic user info on success.
    Returns 401 if credentials are invalid.
    """

    request_data = request.get_json()

    email = request_data.get('email')
    password = request_data.get('password')

    # Look up the user by email address
    user = User.query.filter_by(email=email).first()

    # Check user exists and password matches the stored hash
    # We use a single error message for both cases intentionally
    # Telling the user which one is wrong is a security risk
    password_bytes = password.encode('utf-8')
    stored_hash = user.hashed_password.encode('utf-8') if user else None

    if not user or not bcrypt.checkpw(password_bytes, stored_hash):
        return jsonify({
            "error": "Invalid email or password"
        }), 401

    # Generate a JWT token using the user's ID as the identity
    # This token is sent back to the frontend and included in future requests
    # str() is used because JWT identity must be a string
    access_token = create_access_token(identity=str(user.user_id))

    return jsonify({
        "token": access_token,
        "user": {
            "id": user.user_id,
            "username": user.username,
            "email": user.email
        }
    }), 200