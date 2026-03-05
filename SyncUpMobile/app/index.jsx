// app/index.jsx
// Main entry point for the SyncUp mobile application
// Acts as the central navigator - controls which screen is displayed
// Manages authentication state (logged in user and JWT token)
// Passes necessary data down to child screens via props

import { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';

// Screen imports
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import CalendarsScreen from './screens/CalendarsScreen';
import EventsScreen from './screens/EventsScreen';

export default function SyncUpApp() {

  // Tracks which screen is currently being displayed
  // Possible values: 'login', 'register', 'calendars', 'events'
  const [currentScreen, setCurrentScreen] = useState('login');

  // Stores the logged in user's details returned from the backend
  const [loggedInUser, setLoggedInUser] = useState(null);

  // Stores the JWT token used to authenticate API requests
  const [authToken, setAuthToken] = useState(null);

  // Stores the calendar the user has tapped on to view its events
  const [activeCalendar, setActiveCalendar] = useState(null);

  // Called by LoginScreen when login is successful
  // Saves the token and user then navigates to the calendars screen
  const handleSuccessfulLogin = (token, user) => {
    setAuthToken(token);
    setLoggedInUser(user);
    setCurrentScreen('calendars');
  };

  // Called when the user taps logout
  // Clears all stored auth data and returns to the login screen
  const handleLogout = () => {
    setAuthToken(null);
    setLoggedInUser(null);
    setActiveCalendar(null);
    setCurrentScreen('login');
  };

  // Called when the user taps a calendar in CalendarsScreen
  // Saves the selected calendar and navigates to its events view
  const handleCalendarSelection = (calendar) => {
    setActiveCalendar(calendar);
    setCurrentScreen('events');
  };

  // Render the appropriate screen based on currentScreen state
  if (currentScreen === 'login') {
    return (
      <LoginScreen
        onNavigate={setCurrentScreen}
        onLoginSuccess={handleSuccessfulLogin}
      />
    );
  }

  if (currentScreen === 'register') {
    return (
      <RegisterScreen
        onNavigate={setCurrentScreen}
      />
    );
  }

  if (currentScreen === 'calendars') {
    return (
      <View style={styles.screenContainer}>
        <CalendarsScreen
          authToken={authToken}
          onCalendarSelect={handleCalendarSelection}
        />
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (currentScreen === 'events') {
    return (
      <View style={styles.screenContainer}>
        <EventsScreen
          authToken={authToken}
          selectedCalendar={activeCalendar}
          onBack={() => setCurrentScreen('calendars')}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1
  },
  logoutButton: {
    backgroundColor: '#ff4444',
    padding: 14,
    alignItems: 'center'
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  }
});