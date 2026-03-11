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
const GRID_START_HOUR = 0;
const GRID_END_HOUR = 24;
const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const GRID_HOURS = Array.from(
  { length: GRID_END_HOUR - GRID_START_HOUR + 1 },
  (_, index) => GRID_START_HOUR + index
);

const WORKLOAD_OPTIONS = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' }
];

const RECOVERY_OPTIONS = [
  { label: 'None', value: 'none' },
  { label: 'Short', value: 'short' },
  { label: 'Long', value: 'long' }
];

const CONFIDENCE_OPTIONS = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' }
];


// --- Helper Functions ---

function getWeekDates(referenceDate) {
  const weekStart = new Date(referenceDate);
  const dayOfWeek = weekStart.getDay();
  const distanceFromMonday = (dayOfWeek === 0) ? 6 : dayOfWeek - 1;
  weekStart.setDate(weekStart.getDate() - distanceFromMonday);
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
    if (!placedInGroup) groups.push([event]);
  });

  groups.forEach(group => {
    const totalColumns = group.length;
    group.forEach((event, index) => {
      resolvedEvents.push({ ...event, columnIndex: index, totalColumns });
    });
  });

  return resolvedEvents;
}
function formatHourLabel(hour) {
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  if (hour === 24) return '12am';
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

function padToTwoDigits(number) {
  return String(number).padStart(2, '0');
}
// Calculate recovery bar height based on recovery_time and workload_intensity
function calculateRecoveryBarHeight(recoveryTime, workloadIntensity) {
  const baseHeightMap = { none: 0, short: 0.5 * HOUR_HEIGHT, long: 2 * HOUR_HEIGHT };
  const workloadMultiplierMap = { low: 1, medium: 1.5, high: 2 };
  const base = baseHeightMap[recoveryTime] ?? 0;
  const multiplier = workloadMultiplierMap[workloadIntensity] ?? 1;
  return base * multiplier;
}

// --- Label Selector Component ---
function LabelSelector({ options, selected, onSelect, colour }) {
  return (
    <View style={styles.labelSelectorRow}>
      {options.map(option => (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.labelOption,
            selected === option.value && { backgroundColor: colour, borderColor: colour }
          ]}
          onPress={() => onSelect(option.value)}
        >
          <Text style={[
            styles.labelOptionText,
            selected === option.value && styles.labelOptionTextSelected
          ]}>
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}


// --- Time Slider Component ---

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
  const [isCreateOverlayVisible, setIsCreateOverlayVisible] = useState(false);
  const [isEditOverlayVisible, setIsEditOverlayVisible] = useState(false);
  const [eventBeingEdited, setEventBeingEdited] = useState(null);

  // Controls which view is active: 'calendar' or 'availability'

  const [activeView, setActiveView] = useState('calendar');
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

  // Context-aware availability state
  const [workloadIntensity, setWorkloadIntensity] = useState('medium');
  const [recoveryTime, setRecoveryTime] = useState('none');
  const [confidenceLevel, setConfidenceLevel] = useState('high');

  const gridScrollRef = useRef(null);

  const calendarColour = selectedCalendar.colour || '#4A90E2';
  const screenWidth = Dimensions.get('window').width;
  const timeColumnWidth = 44;
  const dayColumnWidth = (screenWidth - timeColumnWidth) / 7;
  const weekDates = getWeekDates(currentWeekDate);
  const todayDate = new Date();

  useEffect(() => {
    fetchCalendarEvents();
    setTimeout(() => {
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
      console.log((responseData));
      // Handle both a plain array and a wrapped object e.g. { events: [...] }
      if (Array.isArray(responseData)) {
        setEventsList(responseData);
      } else if (responseData && Array.isArray(responseData.events)) {
        setEventsList(responseData.events);
      } else {
        console.warn('Unexpected response shape, defaulting to empty list');
        setEventsList([]);
      }
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
    setWorkloadIntensity('medium');
    setRecoveryTime('none');
    setConfidenceLevel('high');
    setIsCreateOverlayVisible(true);
  };

  const openEditOverlay = (event) => {
    // Normalise field names, backend may return event_id instead of id,
    // start_time/end_time may vary, log the raw event to help debug.
    console.log('Opening edit overlay for event:', JSON.stringify(event));
    const eventId = event.id ?? event.event_id;
    const startTime = event.start_time ?? event.startTime ?? event.start;
    const endTime = event.end_time ?? event.endTime ?? event.end;
    if (!startTime || !endTime) {
      alert('Could not read event times. Check console for details.');
      return;
    }
    const eventStart = new Date(startTime);
    const eventEnd = new Date(endTime);
    const dateString = `${eventStart.getFullYear()}-${padToTwoDigits(eventStart.getMonth() + 1)}-${padToTwoDigits(eventStart.getDate())}`;
    setEventBeingEdited({ ...event, id: eventId, start_time: startTime, end_time: endTime });
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
    setWorkloadIntensity(event.workload_intensity || 'medium');
    setRecoveryTime(event.recovery_time || 'none');
    setConfidenceLevel(event.confidence_level || 'high');
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

  const buildEventPayload = () => ({
    title: eventTitle,
    description: eventDescription,
    location: eventLocation,
    start_time: `${selectedDateString}T${padToTwoDigits(startHour)}:${padToTwoDigits(startMinute)}:00`,
    end_time: `${selectedDateString}T${padToTwoDigits(endHour)}:${padToTwoDigits(endMinute)}:00`,
    workload_intensity: workloadIntensity,
    recovery_time: recoveryTime,
    confidence_level: confidenceLevel
  });

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
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
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
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
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
        { method: 'DELETE', headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      setIsEditOverlayVisible(false);
      setEventBeingEdited(null);
      fetchCalendarEvents();
    } catch (error) {
      alert('Could not delete event');
    }
  };

  const getEventsForDay = (date) => {
    if (!Array.isArray(eventsList)) return [];
    return eventsList.filter(event => {
      const eventDate = new Date(event.start_time);
      return (
        eventDate.getFullYear() === date.getFullYear() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getDate() === date.getDate()
      );
    });
  };

  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('default', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  };

  const monthLabel = currentWeekDate.toLocaleString('default', { month: 'long', year: 'numeric' });


  //Builds per-column availability data for the heatmap view.
 
  const buildAvailabilityGrid = () => {
    return weekDates.map(date => {
      const dayEvents = getEventsForDay(date);
      if (dayEvents.length === 0) {
        const emptySlots = Array(96).fill(null);
        for (let s = 0; s < 24; s++) emptySlots[s] = { type: 'sleep' };
        return emptySlots;
      }

      // 96 slots representing 15-minute intervals in a day
      const slots = Array(96).fill(null);
      for (let s = 0; s < 24; s++) {
        slots[s] = { type: 'sleep' };
      }

      dayEvents.forEach(event => {
        const eventStart = new Date(event.start_time);
        const eventEnd = new Date(event.end_time);
        const startSlot = Math.floor((eventStart.getHours() * 60 + eventStart.getMinutes()) / 15);
        const endSlot = Math.ceil((eventEnd.getHours() * 60 + eventEnd.getMinutes()) / 15);

        // Event slots
        const workloadIntensityMap = { low: 0.4, medium: 0.7, high: 1.0 };
        const eventIntensity = workloadIntensityMap[event.workload_intensity] ?? 1.0;
        for (let s = startSlot; s < endSlot && s < 96; s++) {
          slots[s] = { type: 'event', intensity: eventIntensity };
        }

        // Confidence affects recovery fade speed
        const confidenceFadeValues = { low: 0.3, medium: 0.65, high: 1.0 };
        const confidenceFade = confidenceFadeValues[event.confidence_level] ?? 1.0;

        const recoveryMins = (calculateRecoveryBarHeight(event.recovery_time, event.workload_intensity) / HOUR_HEIGHT) * 60;
        const recoverySlots = Math.ceil(recoveryMins / 15);

        if (recoverySlots > 0) {
          // Recovery gradient
          for (let r = 0; r < recoverySlots; r++) {
            const slot = endSlot + r;
            if (slot >= 96) break;
            const rawProgress = r / recoverySlots;
            const progress = rawProgress * confidenceFade;
            if (slots[slot] === null || (slots[slot].type === 'recovery' && progress < slots[slot].progress)) {
              slots[slot] = { type: 'recovery', progress };
            }
          }
        } else {
          // No recovery period — confidence alone determines spill
          // low = 2hrs of orange tail, medium = 1hr, high = nothing
          const confidenceSpillMins = { low: 120, medium: 60, high: 0 };
          const spillMins = confidenceSpillMins[event.confidence_level] ?? 0;
          const spillSlots = Math.ceil(spillMins / 15);
          for (let r = 0; r < spillSlots; r++) {
            const slot = endSlot + r;
            if (slot >= 96) break;
            const rawProgress = r / spillSlots;
            const progress = rawProgress * confidenceFade;
            if (slots[slot] === null || (slots[slot].type === 'recovery' && progress < slots[slot].progress)) {
              slots[slot] = { type: 'recovery', progress };
            }
          }
        }
      });

      return slots;
    });
  };

  //Converts an availability score (0.0=busy to 1.0=free) into an RGBA colour string.

  const scoreToColour = (slot) => {
    // null = fully available waking hours = your green
    if (slot === null) return 'rgb(118,154,118)';

    // Sleep hours (12am–6am) — light grey
    if (slot.type === 'sleep') return 'rgb(220,220,220)';

    // Event slots
    if (slot.type === 'event') {
      return `rgb(${210},${40},${45})`;
    }

    // Recovery slots — orange → yellow → green
    if (slot.type === 'recovery') {
      const { progress } = slot;
      let r, g, b;
      if (progress < 0.5) {
        const t = progress / 0.5;
        r = 230;
        g = Math.round(110 + (220 - 110) * t);
        b = 0;
      } else {
        const t = (progress - 0.5) / 0.5;
        r = Math.round(230 + (80  - 230) * t);
        g = Math.round(220 + (200 - 220) * t);
        b = Math.round(0   + (80  - 0)   * t);
      }
      return `rgb(${r},${g},${b})`;
    }

    return 'rgb(8,142,1)';
  };

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
          {Array.from({ length: new Date(pickerYear, pickerMonth + 1, 0).getDate() }, (_, i) => i + 1).map(day => (
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
      <TextInput style={styles.inputField} placeholder="Title *" value={eventTitle} onChangeText={setEventTitle} />
      <TextInput style={styles.inputField} placeholder="Description (optional)" value={eventDescription} onChangeText={setEventDescription} />
      <TextInput style={styles.inputField} placeholder="Location (optional)" value={eventLocation} onChangeText={setEventLocation} />

      <Text style={styles.overlaySectionTitle}>TIME</Text>
      <TimeSliderInput label="Start time" hour={startHour} minute={startMinute} onHourChange={setStartHour} onMinuteChange={setStartMinute} colour={calendarColour} />
      <TimeSliderInput label="End time" hour={endHour} minute={endMinute} onHourChange={setEndHour} onMinuteChange={setEndMinute} colour={calendarColour} />

      <Text style={styles.overlaySectionTitle}>AVAILABILITY CONTEXT</Text>

      {/* Workload intensity — how draining the event is */}
      <Text style={styles.contextLabel}>Workload intensity</Text>
      <Text style={styles.contextDescription}>How demanding is this event?</Text>
      <LabelSelector options={WORKLOAD_OPTIONS} selected={workloadIntensity} onSelect={setWorkloadIntensity} colour={calendarColour} />

      {/* Recovery time — how long until available again after this event */}
      <Text style={styles.contextLabel}>Recovery time needed</Text>
      <Text style={styles.contextDescription}>How long do you need to recover after this event?</Text>
      <LabelSelector options={RECOVERY_OPTIONS} selected={recoveryTime} onSelect={setRecoveryTime} colour={calendarColour} />

      {/* Availability confidence — how likely to accept another event after this */}
      <Text style={styles.contextLabel}>Availability confidence</Text>
      <Text style={styles.contextDescription}>How likely are you to be available for another event after this one?</Text>
      <LabelSelector options={CONFIDENCE_OPTIONS} selected={confidenceLevel} onSelect={setConfidenceLevel} colour={calendarColour} />

      {/* Live preview of what these settings will look like on the calendar */}
      <Text style={styles.overlaySectionTitle}>PREVIEW</Text>
      <View style={styles.contextPreviewContainer}>
        {/* Event block preview — opacity reflects confidence level */}
        <View style={[styles.contextPreviewBlock, { backgroundColor: calendarColour }]}>
          <Text style={styles.contextPreviewBlockText}>{eventTitle || 'Event'}</Text>
          <Text style={styles.contextPreviewBlockSubText}>{workloadIntensity} workload</Text>
        </View>
        {/* Recovery bar preview — uses faded calendar colour */}
        {calculateRecoveryBarHeight(recoveryTime, workloadIntensity) > 0 && (
          <View style={[
            styles.contextPreviewRecovery,
            {
              height: Math.min(calculateRecoveryBarHeight(recoveryTime, workloadIntensity), 60),
              backgroundColor: calendarColour,
              opacity: 0.3,
            }
          ]} />
        )}
        <Text style={styles.contextPreviewHint}>
          {recoveryTime === 'none'
            ? confidenceLevel !== 'high'
              ? `Low confidence adds ${confidenceLevel === 'low' ? '2 hour' : '1 hour'} recovery tail`
              : 'No recovery time shown'
            : `Recovery bar: ${recoveryTime} × ${workloadIntensity} workload · confidence affects fade speed`}
        </Text>
      </View>
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

      {/* View Tabs */}
      <View style={styles.viewTabs}>
        <TouchableOpacity
          style={[styles.viewTab, activeView === 'calendar' && { borderBottomColor: calendarColour, borderBottomWidth: 2 }]}
          onPress={() => setActiveView('calendar')}
        >
          <Text style={[styles.viewTabText, activeView === 'calendar' && { color: calendarColour, fontWeight: '700' }]}>
            Calendar
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewTab, activeView === 'availability' && { borderBottomColor: calendarColour, borderBottomWidth: 2 }]}
          onPress={() => setActiveView('availability')}
        >
          <Text style={[styles.viewTabText, activeView === 'availability' && { color: calendarColour, fontWeight: '700' }]}>
            Availability
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
              onPress={() => openCreateOverlay(date)}
            >
              <Text style={styles.dayHeaderName}>{DAYS_OF_WEEK[date.getDay() === 0 ? 6 : date.getDay() - 1]}</Text>
              <View style={[styles.dayHeaderNumber, isToday && { backgroundColor: calendarColour }]}>
                <Text style={[styles.dayHeaderNumberText, isToday && styles.dayHeaderNumberToday]}>
                  {date.getDate()}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Calendar Grid — only shown in calendar tab */}
      {activeView === 'calendar' && (
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

                {dayEvents.map((event, eventIndex) => {
                  const { top, height } = calculateEventPosition(event);
                  const eventWidth = dayColumnWidth / event.totalColumns;
                  const eventLeft = event.columnIndex * eventWidth;

                  // Recovery bar: height = recovery_time × workload_intensity multiplier
                  const uncappedRecoveryHeight = calculateRecoveryBarHeight(event.recovery_time, event.workload_intensity);

                  // Prevent recovery bar overlapping next event
                  let recoveryBarHeight = uncappedRecoveryHeight;
                  if (uncappedRecoveryHeight > 0) {
                    const eventEndMins = new Date(event.end_time).getHours() * 60 + new Date(event.end_time).getMinutes();
                    const nextEvent = dayEvents
                      .filter(other => {
                        const otherStartMins = new Date(other.start_time).getHours() * 60 + new Date(other.start_time).getMinutes();
                        return otherStartMins > eventEndMins;
                      })
                      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))[0];
                    if (nextEvent) {
                      const nextEventTop = calculateEventPosition(nextEvent).top;
                      const maxRecoveryHeight = nextEventTop - (top + height);
                      recoveryBarHeight = Math.min(uncappedRecoveryHeight, Math.max(maxRecoveryHeight, 0));
                    }
                  }

                  return (
                    <View key={event.id} style={{ position: 'absolute', width: '100%', height: 0 }}>

                      {/* Event block — opacity reflects confidence level */}
                      <TouchableOpacity
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
                            {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        )}
                        {height > 45 && (
                          <Text style={styles.eventBlockContext} numberOfLines={1}>
                            {event.workload_intensity} workload
                          </Text>
                        )}
                      </TouchableOpacity>

                      {/* Recovery bar — shown below event block, capped at next event start
                          Uses a faded version of the calendar colour (50% opacity) */}
                      {recoveryBarHeight > 0 && (
                        <View
                          style={{
                            position: 'absolute',
                            top: top + height,
                            left: eventLeft + 1,
                            width: eventWidth - 2,
                            height: recoveryBarHeight,
                            backgroundColor: calendarColour,
                            opacity: 0.35,
                            borderBottomLeftRadius: 4,
                            borderBottomRightRadius: 4,
                          }}
                        />
                      )}

                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>
      )}

      {/* Availability Heatmap — only shown in availability tab */}
      {activeView === 'availability' && (
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

          {/* Heatmap Day Columns — each 15-min slot coloured by availability score */}
          { buildAvailabilityGrid().map((slots, dayIndex) => (
            <View key={dayIndex} style={[styles.dayColumn, { width: dayColumnWidth }]}>
              {slots.map((score, slotIndex) => {
                const colour = scoreToColour(score);
                return (
                  <View
                    key={slotIndex}
                    style={{
                      height: HOUR_HEIGHT / 4,
                      backgroundColor: colour ?? '#fff',
                      borderBottomWidth: slotIndex % 4 === 3 ? 1 : 0,
                      borderBottomColor: 'rgba(0,0,0,0.05)',
                    }}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
      )}

      {/* Create Event Overlay */}
      <Modal visible={isCreateOverlayVisible} animationType="slide">
        <ScrollView contentContainerStyle={styles.overlayContainer} nestedScrollEnabled>
          <Text style={styles.overlayTitle}>New Event</Text>
          {renderEventForm()}
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: calendarColour }]} onPress={handleCreateEvent}>
            <Text style={styles.primaryButtonText}>Create Event</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={() => setIsCreateOverlayVisible(false)}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>

      {/* Edit Event Overlay */}
      <Modal visible={isEditOverlayVisible} animationType="slide">
        <ScrollView contentContainerStyle={styles.overlayContainer} nestedScrollEnabled>
          <Text style={styles.overlayTitle}>Edit Event</Text>
          {renderEventForm()}
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: calendarColour }]} onPress={handleUpdateEvent}>
            <Text style={styles.primaryButtonText}>Save Changes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteEvent}>
            <Text style={styles.deleteButtonText}>Delete Event</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={() => setIsEditOverlayVisible(false)}>
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
    paddingHorizontal: 16, paddingTop: 15, paddingBottom: 12,
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
  dayHeaderNumber: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dayHeaderNumberText: { fontSize: 14, color: '#333', fontWeight: '500' },
  dayHeaderNumberToday: { color: '#fff', fontWeight: 'bold' },
  calendarGrid: { flex: 1 },
  timeLabel: { justifyContent: 'flex-start', paddingTop: 4, paddingRight: 4, alignItems: 'flex-end' },
  timeLabelText: { fontSize: 10, color: '#999' },
  dayColumn: { borderLeftWidth: 1, borderLeftColor: '#f0f0f0', position: 'relative' },
  hourGridLine: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  eventBlock: { position: 'absolute', borderRadius: 4, padding: 3, overflow: 'hidden' },
  eventBlockTitle: { fontSize: 11, color: '#fff', fontWeight: 'bold' },
  eventBlockTime: { fontSize: 10, color: '#fff', opacity: 0.9 },
  eventBlockContext: { fontSize: 9, color: '#fff', opacity: 0.85 },
  overlayContainer: { padding: 24, paddingTop: 60 },
  overlayTitle: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 20 },
  overlaySectionTitle: { fontSize: 13, fontWeight: '700', color: '#999', marginBottom: 10, marginTop: 8 },
  datePicker: { flexDirection: 'row', borderWidth: 1, borderColor: '#eee', borderRadius: 10, overflow: 'hidden', marginBottom: 8 },
  datePickerColumn: { flex: 1, maxHeight: 150 },
  datePickerItem: { padding: 10, alignItems: 'center' },
  datePickerItemText: { fontSize: 14, color: '#333' },
  datePickerItemSelected: { color: '#fff', fontWeight: 'bold' },
  selectedDateDisplay: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 20 },
  inputField: { backgroundColor: '#f5f5f5', padding: 15, borderRadius: 10, marginBottom: 12, fontSize: 16, borderWidth: 1, borderColor: '#ddd' },
  timeSliderContainer: { backgroundColor: '#f9f9f9', borderRadius: 10, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#eee' },
  timeSliderLabel: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 4 },
  timeSliderDisplay: { fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  timeSliderSubLabel: { fontSize: 12, color: '#999', marginBottom: 2 },
  slider: { width: '100%', height: 40 },
  sliderRangeLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  sliderRangeText: { fontSize: 11, color: '#bbb' },
  primaryButton: { padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  deleteButton: { padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 12, backgroundColor: '#fff', borderWidth: 2, borderColor: '#ff4444' },
  deleteButtonText: { color: '#ff4444', fontSize: 16, fontWeight: 'bold' },
  cancelButton: { alignItems: 'center', marginTop: 16, marginBottom: 40 },
  cancelButtonText: { color: '#999', fontSize: 16 },
  labelSelectorRow: { flexDirection: 'row', marginBottom: 16 },
  labelOption: { flex: 1, padding: 10, marginHorizontal: 4, borderRadius: 8, alignItems: 'center', borderWidth: 1.5, borderColor: '#ddd', backgroundColor: '#fff' },
  labelOptionText: { fontSize: 14, color: '#666', fontWeight: '500' },
  labelOptionTextSelected: { color: '#fff', fontWeight: 'bold' },
  contextLabel: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 2 },
  contextDescription: { fontSize: 12, color: '#999', marginBottom: 8 },
  contextPreviewContainer: { backgroundColor: '#f9f9f9', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#eee' },
  contextPreviewBlock: { borderRadius: 4, padding: 8, marginBottom: 0 },
  contextPreviewBlockText: { fontSize: 12, color: '#fff', fontWeight: 'bold' },
  contextPreviewBlockSubText: { fontSize: 10, color: '#fff', opacity: 0.85 },
  contextPreviewRecovery: { borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  contextPreviewHint: { fontSize: 11, color: '#999', marginTop: 8, fontStyle: 'italic' },
  viewTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' },
  viewTab: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  viewTabText: { fontSize: 14, color: '#999', fontWeight: '500' },
});