# models.py
# Defines the database schema for the SyncUp application
# SQLAlchemy is used as an ORM (Object Relational Mapper) which means
# we can interact with the database using Python classes instead of raw SQL

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

# Single shared database instance, initialised with the Flask app in app.py
database = SQLAlchemy()


class User(database.Model):
    """
    Stores registered user accounts for SyncUp.
    Each user owns one or more calendars and can create events within them.
    """

    # Unique identifier auto-incremented for each new user
    user_id = database.Column(database.Integer, primary_key=True)

    # Username shown in the app, must be unique across all accounts
    username = database.Column(database.String(80), unique=True, nullable=False)

    # Email address used to log in, must be unique
    email = database.Column(database.String(120), unique=True, nullable=False)

    # Password is never stored as plain text
    # bcrypt converts it to a one-way hash so it cannot be reversed
    hashed_password = database.Column(database.String(200), nullable=False)

    # Timestamp automatically recorded when the user registers
    date_joined = database.Column(database.DateTime, default=datetime.utcnow)

    # Allows us to access all calendars belonging to this user via user.calendars
    # backref='owner' allows reverse access: calendar.owner returns the user
    calendars = database.relationship('Calendar', backref='owner', lazy=True)


class Calendar(database.Model):
    """
    Represents a calendar owned by a user.
    Every user gets a default personal calendar on registration.
    Additional calendars can be created for different purposes e.g. Work, University.
    Default calendars cannot be deleted.
    """

    # Unique identifier for each calendar
    calendar_id = database.Column(database.Integer, primary_key=True)

    # Name of the calendar displayed in the app e.g. "Work" or "My Calendar"
    name = database.Column(database.String(200), nullable=False)

    # Optional text describing what the calendar is used for
    description = database.Column(database.Text, nullable=True)

    # Hex colour code used to visually distinguish calendars in the UI
    calendar_colour = database.Column(database.String(20), default='#4A90E2')

    # Marks whether this is the user's default calendar
    # Used to prevent deletion of the primary calendar
    is_default = database.Column(database.Boolean, default=False)

    # Timestamp recorded when the calendar is created
    created_at = database.Column(database.DateTime, default=datetime.utcnow)

    # Links this calendar to its owner in the User table
    user_id = database.Column(
        database.Integer,
        database.ForeignKey('user.user_id'),
        nullable=False
    )

    # Allows access to all events in this calendar via calendar.events
    events = database.relationship('Event', backref='calendar', lazy=True)


class Event(database.Model):
    """
    Represents a single scheduled event within a calendar.
    Every event must have a title, start time and end time.
    Events belong to both a specific user and a specific calendar.
    """

    # Unique identifier for each event
    event_id = database.Column(database.Integer, primary_key=True)

    # Short title describing the event e.g. "Team Meeting"
    title = database.Column(database.String(200), nullable=False)

    # Optional longer description providing more detail about the event
    description = database.Column(database.Text, nullable=True)

    # When the event starts - required
    start_time = database.Column(database.DateTime, nullable=False)

    # When the event ends - required, validated to be after start_time in routes
    end_time = database.Column(database.DateTime, nullable=False)

    # Optional location, can be physical address or virtual link
    location = database.Column(database.String(200), nullable=True)

    # Timestamp recorded when this event is added to the database
    created_at = database.Column(database.DateTime, default=datetime.utcnow)

    # Links this event to the user who created it
    user_id = database.Column(
        database.Integer,
        database.ForeignKey('user.user_id'),
        nullable=False
    )

    # Links this event to the calendar it belongs to
    calendar_id = database.Column(
        database.Integer,
        database.ForeignKey('calendar.calendar_id'),
        nullable=False
    )