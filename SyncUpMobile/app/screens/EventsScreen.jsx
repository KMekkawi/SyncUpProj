// app/screens/EventsScreen.jsx
// Displays a weekly calendar grid for a specific calendar
// Events are shown as coloured blocks positioned by their start and end times
// Overlapping events are displayed side by side at half column width
// Tapping an event opens an editor overlay to update or delete it
// Tapping a day header opens a create event overlay for that day

import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, TextInput, ScrollView, Dimensions
} from 'react-native';
import Slider from '@react-native-community/slider';
import BACKEND_URL from '../../config';

// --- Calendar Grid Constants ---
const HOUR_HEIGHT = 60;
const GRID_START_HOUR = 0;   // Grid starts at 12am
const GRID_END_HOUR = 24;    // Grid ends at 12am next day (full 24 hours)
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const GRID_HOURS = Array.from(
  { length: GRID_END_HOUR - GRID_START_HOUR },
  (_, index) => GRID_START_HOUR + index
);


// --- Helper Functions ---

function getWeekDates(referenceDate) {
  const weekStart = new Date(referenceDate);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  return Array.from({ length: 7 }, (_, dayIndex) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + dayIndex);
    return day;
  });
}

function calculateEventPosition(event) {
  const eventStart = new Date(event.start_time);
  const eventEnd = new Date(event.end_time);
  const startMins = (eventStart.getHours() - GRID_START_HOUR) * 60 + eventStart.getMinutes();
  const endMins = (eventEnd.getHours() - GRID_START_HOUR) * 60 + eventEnd.getMinutes();
  const top = (startMins / 60) * HOUR_HEIGHT;
  const height = Math.max(((endMins - startMins) / 60) * HOUR_HEIGHT, 20);
  return { top, height };
}

/**
 * Groups overlapping events so they can be displayed side by side
 * Returns each event with a columnIndex and totalColumns value
 * used to calculate width and horizontal position
 */
function resolveOverlappingEvents(events) {
  const resolvedEvents = [];
  const groups = [];

  const sorted = [...events].sort(
    (a, b) => new Date(a.start_time) - new Date(b.start_time)
  );

  sorted.forEach(event => {
    const eventStart = new Date(event.start_time).getTime();

    let placedInGroup = false;
    for (const group of groups) {
      const groupEnd = Math.max(...group.map(e => new Date(e.end_time).getTime()));
      if (eventStart < groupEnd) {
        group.push(event);
        placedInGroup = true;
        break;
      }
    }

    if (!placedInGroup) {
      groups.push([event]);
    }
  });

  groups.forEach(group => {
    const totalColumns = group.length;
    group.forEach((event, index) => {
      resolvedEvents.push({
        ...event,
        columnIndex: index,
        totalColumns
      });
    });
  });

  return resolvedEvents;
}

/**
 * Formats an hour number into a readable 12 hour time label
 * 0 = 12am, 12 = 12pm, 23 = 11pm
 */
function formatHourLabel(hour) {
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

function padToTwoDigits(number) {
  return String(number).padStart(2, '0');
}


// --- Time Slider Component ---
/**
 * Two sliders for selecting hour (0-23) and minute (0-55 in steps of 5)
 * Displays the selected time in a readable 12 hour format
 */
function TimeSliderInput({ label, hour, minute, onHourChange, onMinuteChange, colour }) {
  return (
    <View style={styles.timeSliderContainer}>
      <Text style={styles.timeSliderLabel}>{label}</Text>
      <Text style={[styles.timeSliderDisplay, { color: colour }]}>
        {formatHourLabel(hour)}:{padToTwoDigits(minute)}
      </Text>

      <Text style={styles.timeSliderSubLabel}>Hour</Text>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={23}
        step={1}
        value={hour}
        onValueChange={value => onHourChange(Math.round(value))}
        minimumTrackTintColor={colour}
        maximumTrackTintColor="#ddd"
        thumbTintColor={colour}
      />
      <View style={styles.sliderRangeLabels}>
        <Text style={styles.sliderRangeText}>12am</Text>
        <Text style={styles.sliderRangeText}>11pm</Text>
      </View>

      <Text style={styles.timeSliderSubLabel}>Minute</Text>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={55}
        step={5}
        value={minute}
        onValueChange={value => onMinuteChange(Math.round(value))}
        minimumTrackTintColor={colour}
        maximumTrackTintColor="#ddd"
        thumbTintColor={colour}
      />
      <View style={styles.sliderRangeLabels}>
        <Text style={styles.sliderRangeText}>:00</Text>
        <Text style={styles.sliderRangeText}>:55</Text>
      </View>
    </View>
  );
}


// --- Main Screen Component ---
export default function EventsScreen({ authToken, selectedCalendar, onBack }) {

  const [eventsList, setEventsList] = useState([]);
  const [currentWeekDate, setCurrentWeekDate] = useState(new Date());

  // Controls visibility of the create event overlay
  const [isCreateOverlayVisible, setIsCreateOverlayVisible] = useState(false);

  // Controls visibility of the edit event overlay
  const [isEditOverlayVisible, setIsEditOverlayVisible] = useState(false);

  // Stores the event currently being edited
  const [eventBeingEdited, setEventBeingEdited] = useState(null);

  // Shared form state used by both create and edit overlays
  const [selectedDateString, setSelectedDateString] = useState('');
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerDay, setPickerDay] = useState(new Date().getDate());
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [startHour, setStartHour] = useState(9);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(10);
  const [endMinute, setEndMinute] = useState(0);

  // Reference to the ScrollView so we can scroll it programmatically on load
  const gridScrollRef = useRef(null);

  const calendarColour = selectedCalendar.colour || '#4A90E2';
  const screenWidth = Dimensions.get('window').width;
  const timeColumnWidth = 44;
  const dayColumnWidth = (screenWidth - timeColumnWidth) / 7;
  const weekDates = getWeekDates(currentWeekDate);
  const todayDate = new Date();

  // Fetch events and scroll to 7am row on initial load
  useEffect(() => {
    fetchCalendarEvents();
    setTimeout(() => {
      // Scroll to 7am on load so the user sees a useful part of the day
      gridScrollRef.current?.scrollTo({ y: HOUR_HEIGHT * 7, animated: true });
    }, 300);
  }, []);

  const fetchCalendarEvents = async () => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/calendars/${selectedCalendar.id}/events`,
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      const responseData = await response.json();
      setEventsList(responseData);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    }
  };

  const goToPreviousWeek = () => {
    const previousWeek = new Date(currentWeekDate);
    previousWeek.setDate(previousWeek.getDate() - 7);
    setCurrentWeekDate(previousWeek);
  };

  const goToNextWeek = () => {
    const nextWeek = new Date(currentWeekDate);
    nextWeek.setDate(nextWeek.getDate() + 7);
    setCurrentWeekDate(nextWeek);
  };

  /**
   * Pre-fills the form with the tapped date and opens the create overlay
   */
  const openCreateOverlay = (date) => {
    const dateString = `${date.getFullYear()}-${padToTwoDigits(date.getMonth() + 1)}-${padToTwoDigits(date.getDate())}`;
    setSelectedDateString(dateString);
    setPickerYear(date.getFullYear());
    setPickerMonth(date.getMonth());
    setPickerDay(date.getDate());
    setStartHour(9); setStartMinute(0);
    setEndHour(10); setEndMinute(0);
    setEventTitle('');
    setEventDescription('');
    setEventLocation('');
    setIsCreateOverlayVisible(true);
  };

  /**
   * Pre-fills the form with the existing event data and opens the edit overlay
   * Called when the user taps an event block on the calendar grid
   */
  const openEditOverlay = (event) => {
    const eventStart = new Date(event.start_time);
    const eventEnd = new Date(event.end_time);
    const dateString = `${eventStart.getFullYear()}-${padToTwoDigits(eventStart.getMonth() + 1)}-${padToTwoDigits(eventStart.getDate())}`;

    setEventBeingEdited(event);
    setSelectedDateString(dateString);
    setPickerYear(eventStart.getFullYear());
    setPickerMonth(eventStart.getMonth());
    setPickerDay(eventStart.getDate());
    setStartHour(eventStart.getHours());
    setStartMinute(eventStart.getMinutes());
    setEndHour(eventEnd.getHours());
    setEndMinute(eventEnd.getMinutes());
    setEventTitle(event.title);
    setEventDescription(event.description || '');
    setEventLocation(event.location || '');
    setIsEditOverlayVisible(true);
  };

  const handleDatePickerChange = (year, month, day) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const clampedDay = Math.min(day, daysInMonth);
    const dateString = `${year}-${padToTwoDigits(month + 1)}-${padToTwoDigits(clampedDay)}`;
    setPickerYear(year);
    setPickerMonth(month);
    setPickerDay(clampedDay);
    setSelectedDateString(dateString);
  };

  /**
   * Builds the event payload sent to the backend from the current form state
   */
  const buildEventPayload = () => ({
    title: eventTitle,
    description: eventDescription,
    location: eventLocation,
    start_time: `${selectedDateString}T${padToTwoDigits(startHour)}:${padToTwoDigits(startMinute)}:00`,
    end_time: `${selectedDateString}T${padToTwoDigits(endHour)}:${padToTwoDigits(endMinute)}:00`
  });

  /**
   * Validates the event form before creating or updating
   * Returns true if valid, false if there are errors
   */
  const validateEventForm = () => {
    if (!eventTitle) {
      alert('Event title is required');
      return false;
    }
    if ((endHour * 60 + endMinute) <= (startHour * 60 + startMinute)) {
      alert('End time must be after start time');
      return false;
    }
    return true;
  };

  const handleCreateEvent = async () => {
    if (!validateEventForm()) return;
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/calendars/${selectedCalendar.id}/events`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(buildEventPayload())
        }
      );
      if (response.ok) {
        setIsCreateOverlayVisible(false);
        fetchCalendarEvents();
      } else {
        const responseData = await response.json();
        alert(responseData.error);
      }
    } catch (error) {
      alert('Could not connect to the server. Check your connection.');
    }
  };

  const handleUpdateEvent = async () => {
    if (!validateEventForm()) return;
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/calendars/${selectedCalendar.id}/events/${eventBeingEdited.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(buildEventPayload())
        }
      );
      if (response.ok) {
        setIsEditOverlayVisible(false);
        setEventBeingEdited(null);
        fetchCalendarEvents();
      } else {
        const responseData = await response.json();
        alert(responseData.error);
      }
    } catch (error) {
      alert('Could not connect to the server. Check your connection.');
    }
  };

  const handleDeleteEvent = async () => {
    try {
      await fetch(
        `${BACKEND_URL}/api/calendars/${selectedCalendar.id}/events/${eventBeingEdited.id}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${authToken}` }
        }
      );
      setIsEditOverlayVisible(false);
      setEventBeingEdited(null);
      fetchCalendarEvents();
    } catch (error) {
      alert('Could not delete event');
    }
  };

  /**
   * Filters the full events list to return only events on a specific date
   */
  const getEventsForDay = (date) => {
    return eventsList.filter(event => {
      const eventDate = new Date(event.start_time);
      return (
        eventDate.getFullYear() === date.getFullYear() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getDate() === date.getDate()
      );
    });
  };

  /**
   * Formats a date string into a readable format for display in the overlay
   * e.g. 2026-03-05 becomes Thursday 5 March 2026
   */
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('default', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  };

  const monthLabel = currentWeekDate.toLocaleString('default', {
    month: 'long', year: 'numeric'
  });

  // Shared form JSX used in both create and edit overlays
  // Extracted to avoid duplicating the same form twice
  const renderEventForm = () => (
    <>
      <Text style={styles.overlaySectionTitle}>DATE</Text>
      <View style={styles.datePicker}>
        <ScrollView style={styles.datePickerColumn} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          {Array.from({ length: 12 }, (_, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.datePickerItem, pickerMonth === i && { backgroundColor: calendarColour }]}
              onPress={() => handleDatePickerChange(pickerYear, i, pickerDay)}
            >
              <Text style={[styles.datePickerItemText, pickerMonth === i && styles.datePickerItemSelected]}>
                {new Date(2000, i).toLocaleString('default', { month: 'short' })}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView style={styles.datePickerColumn} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          {Array.from(
            { length: new Date(pickerYear, pickerMonth + 1, 0).getDate() },
            (_, i) => i + 1
          ).map(day => (
            <TouchableOpacity
              key={day}
              style={[styles.datePickerItem, pickerDay === day && { backgroundColor: calendarColour }]}
              onPress={() => handleDatePickerChange(pickerYear, pickerMonth, day)}
            >
              <Text style={[styles.datePickerItemText, pickerDay === day && styles.datePickerItemSelected]}>
                {day}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView style={styles.datePickerColumn} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          {[2025, 2026, 2027].map(year => (
            <TouchableOpacity
              key={year}
              style={[styles.datePickerItem, pickerYear === year && { backgroundColor: calendarColour }]}
              onPress={() => handleDatePickerChange(year, pickerMonth, pickerDay)}
            >
              <Text style={[styles.datePickerItemText, pickerYear === year && styles.datePickerItemSelected]}>
                {year}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <Text style={[styles.selectedDateDisplay, { color: calendarColour }]}>
        {formatDateForDisplay(selectedDateString)}
      </Text>

      <Text style={styles.overlaySectionTitle}>DETAILS</Text>
      <TextInput
        style={styles.inputField}
        placeholder="Title *"
        value={eventTitle}
        onChangeText={setEventTitle}
      />
      <TextInput
        style={styles.inputField}
        placeholder="Description (optional)"
        value={eventDescription}
        onChangeText={setEventDescription}
      />
      <TextInput
        style={styles.inputField}
        placeholder="Location (optional)"
        value={eventLocation}
        onChangeText={setEventLocation}
      />

      <Text style={styles.overlaySectionTitle}>TIME</Text>
      <TimeSliderInput
        label="Start time"
        hour={startHour}
        minute={startMinute}
        onHourChange={setStartHour}
        onMinuteChange={setStartMinute}
        colour={calendarColour}
      />
      <TimeSliderInput
        label="End time"
        hour={endHour}
        minute={endMinute}
        onHourChange={setEndHour}
        onMinuteChange={setEndMinute}
        colour={calendarColour}
      />
    </>
  );

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={[styles.headerBackButton, { color: calendarColour }]}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerCalendarName}>{selectedCalendar.name}</Text>
        <TouchableOpacity onPress={() => openCreateOverlay(new Date())}>
          <Text style={[styles.headerAddButton, { color: calendarColour }]}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Week Navigation */}
      <View style={styles.weekNavigation}>
        <TouchableOpacity onPress={goToPreviousWeek}>
          <Text style={[styles.weekNavArrow, { color: calendarColour }]}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.weekNavMonthLabel}>{monthLabel}</Text>
        <TouchableOpacity onPress={goToNextWeek}>
          <Text style={[styles.weekNavArrow, { color: calendarColour }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Day Headers Row */}
      <View style={styles.dayHeadersRow}>
        <View style={{ width: timeColumnWidth }} />
        {weekDates.map((date, index) => {
          const isToday =
            date.getDate() === todayDate.getDate() &&
            date.getMonth() === todayDate.getMonth() &&
            date.getFullYear() === todayDate.getFullYear();
          return (
            <TouchableOpacity
              key={index}
              style={[styles.dayHeaderCell, { width: dayColumnWidth }]}
              onPress={() => openCreateOverlay(date)}
            >
              <Text style={styles.dayHeaderName}>{DAYS_OF_WEEK[date.getDay()]}</Text>
              <View style={[styles.dayHeaderNumber, isToday && { backgroundColor: calendarColour }]}>
                <Text style={[styles.dayHeaderNumberText, isToday && styles.dayHeaderNumberToday]}>
                  {date.getDate()}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Calendar Grid */}
      <ScrollView ref={gridScrollRef} style={styles.calendarGrid}>
        <View style={{ flexDirection: 'row' }}>

          {/* Time Labels Column */}
          <View style={{ width: timeColumnWidth }}>
            {GRID_HOURS.map(hour => (
              <View key={hour} style={[styles.timeLabel, { height: HOUR_HEIGHT }]}>
                <Text style={styles.timeLabelText}>{formatHourLabel(hour)}</Text>
              </View>
            ))}
          </View>

          {/* Day Columns with Event Blocks */}
          {weekDates.map((date, dayIndex) => {
            const dayEvents = resolveOverlappingEvents(getEventsForDay(date));
            return (
              <View key={dayIndex} style={[styles.dayColumn, { width: dayColumnWidth }]}>
                {GRID_HOURS.map(hour => (
                  <View key={hour} style={[styles.hourGridLine, { height: HOUR_HEIGHT }]} />
                ))}

                {dayEvents.map(event => {
                  const { top, height } = calculateEventPosition(event);
                  const eventWidth = dayColumnWidth / event.totalColumns;
                  const eventLeft = event.columnIndex * eventWidth;

                  return (
                    <TouchableOpacity
                      key={event.id}
                      style={[
                        styles.eventBlock,
                        {
                          top,
                          height,
                          width: eventWidth - 2,
                          left: eventLeft + 1,
                          backgroundColor: calendarColour
                        }
                      ]}
                      onPress={() => openEditOverlay(event)}
                    >
                      <Text style={styles.eventBlockTitle} numberOfLines={1}>
                        {event.title}
                      </Text>
                      {height > 30 && (
                        <Text style={styles.eventBlockTime} numberOfLines={1}>
                          {new Date(event.start_time).toLocaleTimeString([], {
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Create Event Overlay */}
      <Modal visible={isCreateOverlayVisible} animationType="slide">
        <ScrollView contentContainerStyle={styles.overlayContainer} nestedScrollEnabled>
          <Text style={styles.overlayTitle}>New Event</Text>
          {renderEventForm()}
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: calendarColour }]}
            onPress={handleCreateEvent}
          >
            <Text style={styles.primaryButtonText}>Create Event</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setIsCreateOverlayVisible(false)}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>

      {/* Edit Event Overlay */}
      <Modal visible={isEditOverlayVisible} animationType="slide">
        <ScrollView contentContainerStyle={styles.overlayContainer} nestedScrollEnabled>
          <Text style={styles.overlayTitle}>Edit Event</Text>
          {renderEventForm()}
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: calendarColour }]}
            onPress={handleUpdateEvent}
          >
            <Text style={styles.primaryButtonText}>Save Changes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteEvent}
          >
            <Text style={styles.deleteButtonText}>Delete Event</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setIsEditOverlayVisible(false)}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee'
  },
  headerBackButton: { fontSize: 16, fontWeight: 'bold' },
  headerCalendarName: { fontSize: 17, fontWeight: 'bold', color: '#333' },
  headerAddButton: { fontSize: 16, fontWeight: 'bold' },
  weekNavigation: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8
  },
  weekNavArrow: { fontSize: 28, paddingHorizontal: 10 },
  weekNavMonthLabel: { fontSize: 15, fontWeight: '600', color: '#333' },
  dayHeadersRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee' },
  dayHeaderCell: { alignItems: 'center', paddingVertical: 6 },
  dayHeaderName: { fontSize: 11, color: '#999', marginBottom: 4 },
  dayHeaderNumber: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center'
  },
  dayHeaderNumberText: { fontSize: 14, color: '#333', fontWeight: '500' },
  dayHeaderNumberToday: { color: '#fff', fontWeight: 'bold' },
  calendarGrid: { flex: 1 },
  timeLabel: {
    justifyContent: 'flex-start', paddingTop: 4,
    paddingRight: 4, alignItems: 'flex-end'
  },
  timeLabelText: { fontSize: 10, color: '#999' },
  dayColumn: { borderLeftWidth: 1, borderLeftColor: '#f0f0f0', position: 'relative' },
  hourGridLine: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  eventBlock: {
    position: 'absolute', borderRadius: 4,
    padding: 3, overflow: 'hidden'
  },
  eventBlockTitle: { fontSize: 11, color: '#fff', fontWeight: 'bold' },
  eventBlockTime: { fontSize: 10, color: '#fff', opacity: 0.9 },
  overlayContainer: { padding: 24, paddingTop: 60 },
  overlayTitle: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 20 },
  overlaySectionTitle: {
    fontSize: 13, fontWeight: '700', color: '#999',
    marginBottom: 10, marginTop: 8
  },
  datePicker: {
    flexDirection: 'row', borderWidth: 1, borderColor: '#eee',
    borderRadius: 10, overflow: 'hidden', marginBottom: 8
  },
  datePickerColumn: { flex: 1, maxHeight: 150 },
  datePickerItem: { padding: 10, alignItems: 'center' },
  datePickerItemText: { fontSize: 14, color: '#333' },
  datePickerItemSelected: { color: '#fff', fontWeight: 'bold' },
  selectedDateDisplay: {
    fontSize: 14, fontWeight: '600',
    textAlign: 'center', marginBottom: 20
  },
  inputField: {
    backgroundColor: '#f5f5f5', padding: 15, borderRadius: 10,
    marginBottom: 12, fontSize: 16, borderWidth: 1, borderColor: '#ddd'
  },
  timeSliderContainer: {
    backgroundColor: '#f9f9f9', borderRadius: 10, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: '#eee'
  },
  timeSliderLabel: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 4 },
  timeSliderDisplay: { fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  timeSliderSubLabel: { fontSize: 12, color: '#999', marginBottom: 2 },
  slider: { width: '100%', height: 40 },
  sliderRangeLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  sliderRangeText: { fontSize: 11, color: '#bbb' },
  primaryButton: {
    padding: 15, borderRadius: 10,
    alignItems: 'center', marginTop: 8
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  deleteButton: {
    padding: 15, borderRadius: 10, alignItems: 'center',
    marginTop: 12, backgroundColor: '#fff',
    borderWidth: 2, borderColor: '#ff4444'
  },
  deleteButtonText: { color: '#ff4444', fontSize: 16, fontWeight: 'bold' },
  cancelButton: { alignItems: 'center', marginTop: 16, marginBottom: 40 },
  cancelButtonText: { color: '#999', fontSize: 16 }
});