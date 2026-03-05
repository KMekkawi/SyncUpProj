# routes/calendars.py
# Handles all calendar operations for the SyncUp application
# Event operations have been moved to routes/events.py
# All routes require a valid JWT token - unauthenticated requests are rejected

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import database, Calendar

# Create a blueprint to group all calendar related routes
calendars_blueprint = Blueprint('calendars', __name__)


@calendars_blueprint.route('/', methods=['GET'])
@jwt_required()
def get_user_calendars():
    """
    Returns all calendars belonging to the currently logged in user.
    The default calendar is included and marked with is_default=True.
    """

    # Extract the user ID from the JWT token sent in the request header
    logged_in_user_id = get_jwt_identity()

    # Query the database for all calendars owned by this user
    user_calendars = Calendar.query.filter_by(user_id=logged_in_user_id).all()

    # Build a list of calendar data to return as JSON
    calendar_list = []
    for cal in user_calendars:
        calendar_list.append({
            'id': cal.calendar_id,
            'name': cal.name,
            'description': cal.description,
            'colour': cal.calendar_colour,
            'is_default': cal.is_default,
            'event_count': len(cal.events)
        })

    return jsonify(calendar_list), 200


@calendars_blueprint.route('/', methods=['POST'])
@jwt_required()
def create_new_calendar():
    """
    Creates a new calendar for the logged in user.
    Expects JSON body with name, and optionally description and colour.
    New calendars are never set as default - only the auto-created one is.
    Returns 201 on success, 400 if name is missing or colour is invalid.
    """

    logged_in_user_id = get_jwt_identity()
    request_data = request.get_json()

    calendar_name = request_data.get('name')
    calendar_description = request_data.get('description', '')
    calendar_colour = request_data.get('colour', '#4A90E2')

    # Calendar name is required
    if not calendar_name:
        return jsonify({"error": "Calendar name is required"}), 400

    # Validate colour is a hex code
    if not calendar_colour.startswith('#'):
        return jsonify({"error": "Colour must be a valid hex code"}), 400

    new_calendar = Calendar(
        name=calendar_name,
        description=calendar_description,
        calendar_colour=calendar_colour,
        is_default=False,
        user_id=logged_in_user_id
    )

    database.session.add(new_calendar)
    database.session.commit()

    return jsonify({
        "message": "Calendar created successfully",
        "id": new_calendar.calendar_id
    }), 201


@calendars_blueprint.route('/<int:calendar_id>', methods=['PUT'])
@jwt_required()
def update_calendar(calendar_id):
    """
    Updates an existing calendar's name, description or colour.
    Users can only update their own calendars.
    Returns 404 if the calendar does not exist or belongs to another user.
    """

    logged_in_user_id = get_jwt_identity()

    target_calendar = Calendar.query.filter_by(
        calendar_id=calendar_id,
        user_id=logged_in_user_id
    ).first()

    if not target_calendar:
        return jsonify({"error": "Calendar not found"}), 404

    request_data = request.get_json()

    # Only update fields that were included in the request
    if 'name' in request_data:
        target_calendar.name = request_data['name']

    if 'description' in request_data:
        target_calendar.description = request_data['description']

    if 'colour' in request_data:
        if not request_data['colour'].startswith('#'):
            return jsonify({"error": "Colour must be a valid hex code"}), 400
        target_calendar.calendar_colour = request_data['colour']

    database.session.commit()

    return jsonify({"message": "Calendar updated successfully"}), 200


@calendars_blueprint.route('/<int:calendar_id>', methods=['DELETE'])
@jwt_required()
def delete_calendar(calendar_id):
    """
    Deletes a calendar and all its events.
    Users can only delete their own calendars.
    The default personal calendar cannot be deleted.
    Returns 404 if calendar not found, 400 if trying to delete default.
    """

    logged_in_user_id = get_jwt_identity()

    # Find the calendar - filter by both calendar_id and user_id
    # This prevents users from deleting other users calendars
    target_calendar = Calendar.query.filter_by(
        calendar_id=calendar_id,
        user_id=logged_in_user_id
    ).first()

    if not target_calendar:
        return jsonify({"error": "Calendar not found"}), 404

    # Prevent deletion of the default calendar
    if target_calendar.is_default:
        return jsonify({
            "error": "Your default calendar cannot be deleted"
        }), 400

    database.session.delete(target_calendar)
    database.session.commit()

    return jsonify({"message": "Calendar deleted successfully"}), 200
