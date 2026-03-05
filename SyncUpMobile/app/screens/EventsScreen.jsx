// app/screens/EventsScreen.jsx
// Displays a weekly calendar grid for a specific calendar
// Events are shown as coloured blocks positioned by their start and end times
// Users can tap a day header to create a new event on that day
// Users can tap the Add button to create an event with a full date picker
// Long pressing an event deletes it

import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, TextInput, ScrollView, Dimensions
} from 'react-native';
import Slider from '@react-native-community/slider';
import BACKEND_URL from '../../config';

// --- Calendar Grid Constants ---
const HOUR_HEIGHT = 60;        // Pixel height of each hour row in the grid
const GRID_START_HOUR = 7;     // Grid starts at 7am
const GRID_END_HOUR = 23;      // Grid ends at 11pm
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Generate the array of hours to display in the grid
const GRID_HOURS = Array.from(
  { length: GRID_END_HOUR - GRID_START_HOUR },
  (_, index) => GRID_START_HOUR + index
);


// --- Helper Functions ---

/**
 * Returns an array of 7 Date objects representing the current week
 * Always starts from Sunday of the week containing the given date
 */
function getWeekDates(referenceDate) {
  const weekStart = new Date(referenceDate);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  return Array.from({ length: 7 }, (_, dayIndex) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + dayIndex);
    return day;
  });
}

/**
 * Calculates the pixel position and height of an event block on the grid
 * Based on the event start and end times relative to GRID_START_HOUR
 */
function calculateEventPosition(event) {
  const eventStart = new Date(event.start_time);
  const eventEnd = new Date(event.end_time);

  const startMinutesFromGridTop =
    (eventStart.getHours() - GRID_START_HOUR) * 60 + eventStart.getMinutes();
  const endMinutesFromGridTop =
    (eventEnd.getHours() - GRID_START_HOUR) * 60 + eventEnd.getMinutes();

  const topPosition = (startMinutesFromGridTop / 60) * HOUR_HEIGHT;
  const blockHeight = Math.max(
    ((endMinutesFromGridTop - startMinutesFromGridTop) / 60) * HOUR_HEIGHT,
    20 // Minimum height so very short events are still visible
  );

  return { top: topPosition, height: blockHeight };
}

/**
 * Formats an hour number into a readable time label
 * e.g. 0 = 12am, 9 = 9am, 13 = 1pm
 */
function formatHourLabel(hour) {
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

/**
 * Pads a number to 2 digits e.g. 9 becomes 09
 */
function padToTwoDigits(number) {
  return String(number).padStart(2, '0');
}


// --- Time Slider Component ---
/**
 * Displays two sliders for selecting hour and minute separately
 * Hour slider goes from 0 to 23, minute slider goes from 0 to 55 in steps of 5
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

  // List of events fetched from the backend for this calendar
  const [eventsList, setEventsList] = useState([]);

  // The week currently being displayed - starts on todays week
  const [currentWeekDate, setCurrentWeekDate] = useState(new Date());

  // Controls whether the create event modal is visible
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Date picker state for the create event modal
  const [selectedDateString, setSelectedDateString] = useState('');
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerDay, setPickerDay] = useState(new Date().getDate());

  // Event form fields
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventLocation, setEventLocation] = useState('');

  // Time slider state for start and end times
  const [startHour, setStartHour] = useState(9);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(10);
  const [endMinute, setEndMinute] = useState(0);

  // Reference to the ScrollView so we can scroll it programmatically
  const gridScrollRef = useRef(null);

  // Use the calendar colour throughout - fall back to blue if not set
  const calendarColour = selectedCalendar.colour || '#4A90E2';

  // Calculate day column dimensions based on screen width
  const screenWidth = Dimensions.get('window').width;
  const timeColumnWidth = 44;
  const dayColumnWidth = (screenWidth - timeColumnWidth) / 7;

  const weekDates = getWeekDates(currentWeekDate);
  const todayDate = new Date();

  // Fetch events and scroll to 7am on initial load
  useEffect(() => {
    fetchCalendarEvents();
    setTimeout(() => {
      gridScrollRef.current?.scrollTo({ y: HOUR_HEIGHT * 2, animated: true });
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
   * Opens the create event modal pre-filled with the tapped date
   * Called when the user taps a day header in the calendar grid
   */
  const openCreateEventModal = (date) => {
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
    setIsModalVisible(true);
  };

  /**
   * Updates the selected date when user changes month, day or year
   * Clamps the day to prevent invalid dates e.g. Feb 31
   */
  const handleDatePickerChange = (year, month, day) => {
    const daysInSelectedMonth = new Date(year, month + 1, 0).getDate();
    const clampedDay = Math.min(day, daysInSelectedMonth);
    const dateString = `${year}-${padToTwoDigits(month + 1)}-${padToTwoDigits(clampedDay)}`;
    setPickerYear(year);
    setPickerMonth(month);
    setPickerDay(clampedDay);
    setSelectedDateString(dateString);
  };

  const handleCreateEvent = async () => {
    if (!eventTitle) {
      alert('Event title is required');
      return;
    }

    // Validate end time is after start time
    const totalStartMinutes = startHour * 60 + startMinute;
    const totalEndMinutes = endHour * 60 + endMinute;
    if (totalEndMinutes <= totalStartMinutes) {
      alert('End time must be after start time');
      return;
    }

    // Build ISO datetime strings for the backend
    const startISO = `${selectedDateString}T${padToTwoDigits(startHour)}:${padToTwoDigits(startMinute)}:00`;
    const endISO = `${selectedDateString}T${padToTwoDigits(endHour)}:${padToTwoDigits(endMinute)}:00`;

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/calendars/${selectedCalendar.id}/events`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            title: eventTitle,
            description: eventDescription,
            location: eventLocation,
            start_time: startISO,
            end_time: endISO
          })
        }
      );

      if (response.ok) {
        setIsModalVisible(false);
        fetchCalendarEvents();
      } else {
        const responseData = await response.json();
        alert(responseData.error);
      }
    } catch (error) {
      alert('Could not connect to the server. Check your connection.');
    }
  };

  const handleDeleteEvent = async (eventId) => {
    try {
      await fetch(
        `${BACKEND_URL}/api/calendars/${selectedCalendar.id}/events/${eventId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${authToken}` }
        }
      );
      fetchCalendarEvents();
    } catch (error) {
      alert('Could not delete event');
    }
  };

  /**
   * Filters the events list to return only events on a specific date
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
   * Formats a date string into a readable format for display
   * e.g. 2026-03-05 becomes Thursday 5 March 2026
   */
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('default', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const monthLabel = currentWeekDate.toLocaleString('default', {
    month: 'long',
    year: 'numeric'
  });

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={[styles.headerBackButton, { color: calendarColour }]}>
            Back
          </Text>
        </TouchableOpacity>
        <Text style={styles.headerCalendarName}>{selectedCalendar.name}</Text>
        <TouchableOpacity onPress={() => openCreateEventModal(new Date())}>
          <Text style={[styles.headerAddButton, { color: calendarColour }]}>
            + Add
          </Text>
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
              onPress={() => openCreateEventModal(date)}
            >
              <Text style={styles.dayHeaderName}>
                {DAYS_OF_WEEK[date.getDay()]}
              </Text>
              <View style={[
                styles.dayHeaderNumber,
                isToday && { backgroundColor: calendarColour }
              ]}>
                <Text style={[
                  styles.dayHeaderNumberText,
                  isToday && styles.dayHeaderNumberToday
                ]}>
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
            const dayEvents = getEventsForDay(date);
            return (
              <View
                key={dayIndex}
                style={[styles.dayColumn, { width: dayColumnWidth }]}
              >
                {/* Hour grid lines */}
                {GRID_HOURS.map(hour => (
                  <View
                    key={hour}
                    style={[styles.hourGridLine, { height: HOUR_HEIGHT }]}
                  />
                ))}

                {/* Event blocks positioned absolutely within the day column */}
                {dayEvents.map(event => {
                  const { top, height } = calculateEventPosition(event);
                  return (
                    <TouchableOpacity
                      key={event.id}
                      style={[
                        styles.eventBlock,
                        {
                          top,
                          height,
                          backgroundColor: calendarColour
                        }
                      ]}
                      onLongPress={() => handleDeleteEvent(event.id)}
                    >
                      <Text style={styles.eventBlockTitle} numberOfLines={1}>
                        {event.title}
                      </Text>
                      {height > 30 && (
                        <Text style={styles.eventBlockTime} numberOfLines={1}>
                          {new Date(event.start_time).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
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

      {/* Create Event Modal */}
      <Modal visible={isModalVisible} animationType="slide">
        <ScrollView contentContainerStyle={styles.modalContainer} nestedScrollEnabled>
          <Text style={styles.modalTitle}>New Event</Text>

          {/* Date Picker */}
          <Text style={styles.modalSectionTitle}>DATE</Text>
          <View style={styles.datePicker}>

            {/* Month Picker */}
            <ScrollView
              style={styles.datePickerColumn}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {Array.from({ length: 12 }, (_, monthIndex) => (
                <TouchableOpacity
                  key={monthIndex}
                  style={[
                    styles.datePickerItem,
                    pickerMonth === monthIndex && {
                      backgroundColor: calendarColour
                    }
                  ]}
                  onPress={() => handleDatePickerChange(pickerYear, monthIndex, pickerDay)}
                >
                  <Text style={[
                    styles.datePickerItemText,
                    pickerMonth === monthIndex && styles.datePickerItemSelected
                  ]}>
                    {new Date(2000, monthIndex).toLocaleString('default', { month: 'short' })}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Day Picker */}
            <ScrollView
              style={styles.datePickerColumn}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {Array.from(
                { length: new Date(pickerYear, pickerMonth + 1, 0).getDate() },
                (_, i) => i + 1
              ).map(day => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.datePickerItem,
                    pickerDay === day && { backgroundColor: calendarColour }
                  ]}
                  onPress={() => handleDatePickerChange(pickerYear, pickerMonth, day)}
                >
                  <Text style={[
                    styles.datePickerItemText,
                    pickerDay === day && styles.datePickerItemSelected
                  ]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Year Picker */}
            <ScrollView
              style={styles.datePickerColumn}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {[2025, 2026, 2027].map(year => (
                <TouchableOpacity
                  key={year}
                  style={[
                    styles.datePickerItem,
                    pickerYear === year && { backgroundColor: calendarColour }
                  ]}
                  onPress={() => handleDatePickerChange(year, pickerMonth, pickerDay)}
                >
                  <Text style={[
                    styles.datePickerItemText,
                    pickerYear === year && styles.datePickerItemSelected
                  ]}>
                    {year}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Selected date displayed as readable text */}
          <Text style={[styles.selectedDateDisplay, { color: calendarColour }]}>
            {formatDateForDisplay(selectedDateString)}
          </Text>

          {/* Event Details */}
          <Text style={styles.modalSectionTitle}>DETAILS</Text>
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

          {/* Time Sliders */}
          <Text style={styles.modalSectionTitle}>TIME</Text>
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

          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: calendarColour }]}
            onPress={handleCreateEvent}
          >
            <Text style={styles.createButtonText}>Create Event</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setIsModalVisible(false)}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  headerBackButton: { fontSize: 16, fontWeight: 'bold' },
  headerCalendarName: { fontSize: 17, fontWeight: 'bold', color: '#333' },
  headerAddButton: { fontSize: 16, fontWeight: 'bold' },
  weekNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8
  },
  weekNavArrow: { fontSize: 28, paddingHorizontal: 10 },
  weekNavMonthLabel: { fontSize: 15, fontWeight: '600', color: '#333' },
  dayHeadersRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  dayHeaderCell: { alignItems: 'center', paddingVertical: 6 },
  dayHeaderName: { fontSize: 11, color: '#999', marginBottom: 4 },
  dayHeaderNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dayHeaderNumberText: { fontSize: 14, color: '#333', fontWeight: '500' },
  dayHeaderNumberToday: { color: '#fff', fontWeight: 'bold' },
  calendarGrid: { flex: 1 },
  timeLabel: {
    justifyContent: 'flex-start',
    paddingTop: 4,
    paddingRight: 4,
    alignItems: 'flex-end'
  },
  timeLabelText: { fontSize: 10, color: '#999' },
  dayColumn: {
    borderLeftWidth: 1,
    borderLeftColor: '#f0f0f0',
    position: 'relative'
  },
  hourGridLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  eventBlock: {
    position: 'absolute',
    left: 1,
    right: 1,
    borderRadius: 4,
    padding: 3,
    overflow: 'hidden'
  },
  eventBlockTitle: { fontSize: 11, color: '#fff', fontWeight: 'bold' },
  eventBlockTime: { fontSize: 10, color: '#fff', opacity: 0.9 },
  modalContainer: { padding: 24, paddingTop: 60 },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#999',
    marginBottom: 10,
    marginTop: 8
  },
  datePicker: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8
  },
  datePickerColumn: { flex: 1, maxHeight: 150 },
  datePickerItem: { padding: 10, alignItems: 'center' },
  datePickerItemText: { fontSize: 14, color: '#333' },
  datePickerItemSelected: { color: '#fff', fontWeight: 'bold' },
  selectedDateDisplay: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20
  },
  inputField: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    marginBottom: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd'
  },
  timeSliderContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eee'
  },
  timeSliderLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 4
  },
  timeSliderDisplay: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12
  },
  timeSliderSubLabel: { fontSize: 12, color: '#999', marginBottom: 2 },
  slider: { width: '100%', height: 40 },
  sliderRangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  sliderRangeText: { fontSize: 11, color: '#bbb' },
  createButton: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8
  },
  createButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cancelButton: { alignItems: 'center', marginTop: 16, marginBottom: 40 },
  cancelButtonText: { color: '#999', fontSize: 16 }
});