// app/screens/LoginScreen.jsx
// Displays the login form for existing SyncUp users
// On successful login receives a JWT token from the backend
// which is passed back up to index.jsx to be stored in state

import { useState } from 'react';
import {
  View, Text, TextInput,
  TouchableOpacity, StyleSheet
} from 'react-native';
import BACKEND_URL from '../../config';

export default function LoginScreen({ onNavigate, onLoginSuccess }) {

  // Stores the values typed into the input fields
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  // Tracks whether a login request is currently in progress
  // Used to disable the button and show loading text while waiting
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginPress = async () => {
    setIsLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput,
          password: passwordInput
        })
      });

      const responseData = await response.json();

      if (response.ok) {
        // Pass the token and user data up to index.jsx
        onLoginSuccess(responseData.token, responseData.user);
      } else {
        // Show the error message returned by the backend
        alert(responseData.error);
      }

    } catch (error) {
      // This catches network errors e.g. backend not running
      alert('Could not connect to the server. Check your connection.');
    }

    setIsLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.appTitle}>SyncUp</Text>
      <Text style={styles.screenSubtitle}>Welcome back</Text>

      <TextInput
        style={styles.inputField}
        placeholder="Email address"
        value={emailInput}
        onChangeText={setEmailInput}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.inputField}
        placeholder="Password"
        value={passwordInput}
        onChangeText={setPasswordInput}
        secureTextEntry
      />

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleLoginPress}
        disabled={isLoading}
      >
        <Text style={styles.primaryButtonText}>
          {isLoading ? 'Logging in...' : 'Login'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => onNavigate('register')}>
        <Text style={styles.navigationLink}>
          Don't have an account? Register
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8
  },
  screenSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32
  },
  inputField: {
    width: '100%',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd'
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#4A90E2',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  navigationLink: {
    color: '#4A90E2',
    fontSize: 14
  }
});