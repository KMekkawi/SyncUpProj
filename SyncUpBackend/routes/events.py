# routes/events.py
# Handles all event operations for the SyncUp application
# Events always belong to a specific calendar and user
# All routes require a valid JWT token - unauthenticated requests are rejected

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import database, Event, Calendar
from datetime import datetime

# Create a blueprint to group all event related routes
events_blueprint = Blueprint('events', __name__)


@events_blueprint.route('/<int:calendar_id>/events', methods=['GET'])
@jwt_required()
def get_calendar_events(calendar_id):
    """
    Returns all events in a specific calendar ordered by start time.
    Only the calendar owner can view its events.
    Returns 404 if the calendar does not exist or belongs to another user.
    """

    logged_in_user_id = get_jwt_identity()

    # Verify the calendar exists and belongs to this user
    target_calendar = Calendar.query.filter_by(
        calendar_id=calendar_id,
        user_id=logged_in_user_id
    ).first()

    if not target_calendar:
        return jsonify({"error": "Calendar not found"}), 404

    # Get all events ordered by start time so they appear chronologically
    calendar_events = Event.query.filter_by(
        calendar_id=calendar_id
    ).order_by(Event.start_time).all()

    event_list = []
    for event in calendar_events:
        event_list.append({
            'id': event.event_id,
            'title': event.title,
            'description': event.description,
            'start_time': event.start_time.isoformat(),
            'end_time': event.end_time.isoformat(),
            'location': event.location
        })

    return jsonify(event_list), 200


@events_blueprint.route('/<int:calendar_id>/events', methods=['POST'])
@jwt_required()
def create_calendar_event(calendar_id):
    """
    Creates a new event inside a specific calendar.
    Expects JSON body with title, start_time and end_time as required fields.
    Validates that end time is after start time before saving.
    Returns 201 on success, 400 if validation fails, 404 if calendar not found.
    """

    logged_in_user_id = get_jwt_identity()

    # Verify the calendar exists and belongs to this user
    target_calendar = Calendar.query.filter_by(
        calendar_id=calendar_id,
        user_id=logged_in_user_id
    ).first()

    if not target_calendar:
        return jsonify({"error": "Calendar not found"}), 404

    request_data = request.get_json()

    event_title = request_data.get('title')
    event_description = request_data.get('description', '')
    event_location = request_data.get('location', '')
    start_time_str = request_data.get('start_time')
    end_time_str = request_data.get('end_time')

    # Validate all required fields are present
    if not event_title or not start_time_str or not end_time_str:
        return jsonify({
            "error": "Title, start time and end time are required"
        }), 400

    # Validate title is not too long
    if len(event_title) > 200:
        return jsonify({"error": "Title must be under 200 characters"}), 400

    # Convert ISO string timestamps to Python datetime objects
    event_start = datetime.fromisoformat(start_time_str)
    event_end = datetime.fromisoformat(end_time_str)

    # Validate end time is after start time
    # This is also checked on the frontend but backend validation is essential
    # as users could bypass the app and send requests directly to the API
    if event_end <= event_start:
        return jsonify({
            "error": "End time must be after start time"
        }), 400

    new_event = Event(
        title=event_title,
        description=event_description,
        start_time=event_start,
        end_time=event_end,
        location=event_location,
        user_id=logged_in_user_id,
        calendar_id=calendar_id
    )

    database.session.add(new_event)
    database.session.commit()

    return jsonify({
        "message": "Event created successfully",
        "id": new_event.event_id
    }), 201


@events_blueprint.route('/<int:calendar_id>/events/<int:event_id>', methods=['PUT'])
@jwt_required()
def update_calendar_event(calendar_id, event_id):
    """
    Updates an existing event in a calendar.
    Only fields included in the request body are updated.
    Fields not included keep their existing values.
    Returns 404 if the event does not exist or belongs to another user.
    """

    logged_in_user_id = get_jwt_identity()

    # Find the event - check calendar_id, event_id and user_id for full ownership
    target_event = Event.query.filter_by(
        event_id=event_id,
        calendar_id=calendar_id,
        user_id=logged_in_user_id
    ).first()

    if not target_event:
        return jsonify({"error": "Event not found"}), 404

    request_data = request.get_json()

    # Only update fields that were included in the request
    # If a field is not provided, keep the existing value
    if 'title' in request_data:
        if len(request_data['title']) > 200:
            return jsonify({"error": "Title must be under 200 characters"}), 400
        target_event.title = request_data['title']

    if 'description' in request_data:
        target_event.description = request_data['description']

    if 'location' in request_data:
        target_event.location = request_data['location']

    if 'start_time' in request_data:
        target_event.start_time = datetime.fromisoformat(request_data['start_time'])

    if 'end_time' in request_data:
        target_event.end_time = datetime.fromisoformat(request_data['end_time'])

    # Validate end time is still after start time after any updates
    if target_event.end_time <= target_event.start_time:
        return jsonify({
            "error": "End time must be after start time"
        }), 400

    database.session.commit()

    return jsonify({"message": "Event updated successfully"}), 200


@events_blueprint.route('/<int:calendar_id>/events/<int:event_id>', methods=['DELETE'])
@jwt_required()
def delete_calendar_event(calendar_id, event_id):
    """
    Deletes a specific event from a calendar.
    Users can only delete events they created in their own calendars.
    Returns 404 if the event does not exist or belongs to another user.
    """

    logged_in_user_id = get_jwt_identity()

    # Filter by all three IDs to ensure full ownership verification
    target_event = Event.query.filter_by(
        event_id=event_id,
        calendar_id=calendar_id,
        user_id=logged_in_user_id
    ).first()

    if not target_event:
        return jsonify({"error": "Event not found"}), 404

    database.session.delete(target_event)
    database.session.commit()

    return jsonify({"message": "Event deleted successfully"}), 200