// app/screens/CalendarsScreen.jsx
// Displays all calendars belonging to the logged in user
// The default personal calendar is shown separately at the top
// Users can create additional calendars and delete non-default ones
// Tapping a calendar navigates to its weekly events view

import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Modal, TextInput, ScrollView
} from 'react-native';
import BACKEND_URL from '../../config';

export default function CalendarsScreen({ authToken, onCalendarSelect }) {

  // Stores the list of calendars fetched from the backend
  const [calendarList, setCalendarList] = useState([]);

  // Controls whether the create calendar modal is visible
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Stores the values typed into the create calendar form
  const [newCalendarName, setNewCalendarName] = useState('');
  const [newCalendarDescription, setNewCalendarDescription] = useState('');
  const [selectedColour, setSelectedColour] = useState('#4A90E2');

  // Fetch calendars when the screen first loads
  useEffect(() => {
    fetchUserCalendars();
  }, []);

  const fetchUserCalendars = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/calendars/`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const responseData = await response.json();
      setCalendarList(responseData);
    } catch (error) {
      console.error('Failed to fetch calendars:', error);
    }
  };

  const handleCreateCalendar = async () => {
    if (!newCalendarName) {
      alert('Calendar name is required');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/calendars/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          name: newCalendarName,
          description: newCalendarDescription,
          colour: selectedColour
        })
      });

      if (response.ok) {
        // Close the modal, reset the form and refresh the calendar list
        setIsModalVisible(false);
        setNewCalendarName('');
        setNewCalendarDescription('');
        setSelectedColour('#4A90E2');
        fetchUserCalendars();
      } else {
        const responseData = await response.json();
        alert(responseData.error);
      }
    } catch (error) {
      alert('Could not connect to the server. Check your connection.');
    }
  };

  const handleDeleteCalendar = async (calendarId) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/calendars/${calendarId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        fetchUserCalendars();
      } else {
        const responseData = await response.json();
        alert(responseData.error);
      }
    } catch (error) {
      alert('Could not connect to the server. Check your connection.');
    }
  };

  // Separate default calendar from user created calendars
  const defaultCalendar = calendarList.filter(cal => cal.is_default);
  const userCalendars = calendarList.filter(cal => !cal.is_default);

  // Colour options available when creating a new calendar
  const colourOptions = [
    '#4A90E2', // Blue
    '#E24A4A', // Red
    '#4AE26A', // Green
    '#E2A44A', // Orange
    '#9B4AE2'  // Purple
  ];

  const renderCalendarCard = ({ item }) => (
    <TouchableOpacity
      style={[styles.calendarCard, { borderLeftColor: item.colour }]}
      onPress={() => onCalendarSelect(item)}
    >
      <View style={styles.calendarCardInfo}>
        <Text style={styles.calendarCardName}>{item.name}</Text>
        {item.description ? (
          <Text style={styles.calendarCardDescription}>{item.description}</Text>
        ) : null}
        <Text style={styles.calendarCardEventCount}>
          {item.event_count} {item.event_count === 1 ? 'event' : 'events'}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => handleDeleteCalendar(item.id)}
        style={styles.deleteButton}
      >
        <Text style={styles.deleteButtonText}>X</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>My Calendars</Text>

      {/* Default calendar shown separately at the top */}
      {defaultCalendar.length > 0 && (
        <View>
          <Text style={styles.sectionHeading}>DEFAULT</Text>
          {defaultCalendar.map(cal => (
            <TouchableOpacity
              key={cal.id}
              style={[styles.calendarCard, { borderLeftColor: cal.colour }]}
              onPress={() => onCalendarSelect(cal)}
            >
              <View style={styles.calendarCardInfo}>
                <Text style={styles.calendarCardName}>{cal.name}</Text>
                {cal.description ? (
                  <Text style={styles.calendarCardDescription}>{cal.description}</Text>
                ) : null}
                <Text style={styles.calendarCardEventCount}>
                  {cal.event_count} {cal.event_count === 1 ? 'event' : 'events'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* User created calendars */}
      {userCalendars.length > 0 && (
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionHeading}>MY CALENDARS</Text>
          <FlatList
            data={userCalendars}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderCalendarCard}
          />
        </View>
      )}

      {/* Shared Calendars Section */}
      <View style={{ flex: 0.70 }}>
        <Text style={styles.sectionHeading}>SHARED CALENDARS</Text>
            <Text style={styles.emptyMessage}> No shared calendars yet. This feature is coming in a future update.</Text>
      </View>

      {userCalendars.length === 0 && (
        <Text style={styles.emptyMessage}>
          No other calendars yet. Create one below.
        </Text>
      )}

      <TouchableOpacity
        style={styles.createButton}
        onPress={() => setIsModalVisible(true)}
      >
        <Text style={styles.createButtonText}>+ New Calendar</Text>
      </TouchableOpacity>

      {/* Create Calendar Modal */}
      <Modal visible={isModalVisible} animationType="slide">
        <ScrollView contentContainerStyle={styles.modalContainer}>
          <Text style={styles.modalTitle}>New Calendar</Text>

          <TextInput
            style={styles.inputField}
            placeholder="Name *"
            value={newCalendarName}
            onChangeText={setNewCalendarName}
          />

          <TextInput
            style={styles.inputField}
            placeholder="Description (optional)"
            value={newCalendarDescription}
            onChangeText={setNewCalendarDescription}
          />

          <Text style={styles.colourLabel}>Colour</Text>
          <View style={styles.colourPickerRow}>
            {colourOptions.map(colour => (
              <TouchableOpacity
                key={colour}
                style={[
                  styles.colourOption,
                  { backgroundColor: colour },
                  selectedColour === colour && styles.colourOptionSelected
                ]}
                onPress={() => setSelectedColour(colour)}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: selectedColour }]}
            onPress={handleCreateCalendar}
          >
            <Text style={styles.createButtonText}>Create Calendar</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
    paddingTop: 30
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#999',
    marginBottom: 8,
    marginTop: 8
  },
  calendarCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
    borderLeftWidth: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2
  },
  calendarCardInfo: { flex: 1 },
  calendarCardName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333'
  },
  calendarCardDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2
  },
  calendarCardEventCount: {
    fontSize: 13,
    color: '#999',
    marginTop: 4
  },
  deleteButton: { padding: 8 },
  deleteButtonText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: 'bold'
  },
  emptyMessage: {
    textAlign: 'center',
    color: '#999',
    marginTop: 20,
    fontSize: 16
  },
  createButton: {
    backgroundColor: '#4A90E2',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  modalContainer: { padding: 30, paddingTop: 60 },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20
  },
  inputField: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd'
  },
  colourLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8
  },
  colourPickerRow: {
    flexDirection: 'row',
    marginBottom: 20
  },
  colourOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12
  },
  colourOptionSelected: {
    borderWidth: 3,
    borderColor: '#333'
  },
  cancelButton: { alignItems: 'center', marginTop: 16 },
  cancelButtonText: { color: '#999', fontSize: 16 }
});