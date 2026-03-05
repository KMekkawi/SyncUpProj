// app/screens/RegisterScreen.jsx
// Displays the registration form for new SyncUp users
// On successful registration navigates back to the login screen
// A default personal calendar is automatically created by the backend

import { useState } from 'react';
import {
  View, Text, TextInput,
  TouchableOpacity, StyleSheet
} from 'react-native';
import BACKEND_URL from '../../config';

export default function RegisterScreen({ onNavigate }) {

  // Stores the values typed into the input fields
  const [usernameInput, setUsernameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  // Tracks whether a registration request is currently in progress
  const [isLoading, setIsLoading] = useState(false);

  const handleRegisterPress = async () => {

    // Basic frontend validation before sending to backend
    if (!usernameInput || !emailInput || !passwordInput) {
      alert('Please fill in all fields');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usernameInput,
          email: emailInput,
          password: passwordInput
        })
      });

      const responseData = await response.json();

      if (response.ok) {
        // Registration successful - navigate to login
        // User must log in manually after registering
        alert('Account created successfully. Please log in.');
        onNavigate('login');
      } else {
        alert(responseData.error);
      }

    } catch (error) {
      alert('Could not connect to the server. Check your connection.');
    }

    setIsLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.appTitle}>SyncUp</Text>
      <Text style={styles.screenSubtitle}>Create an account</Text>

      <TextInput
        style={styles.inputField}
        placeholder="Username"
        value={usernameInput}
        onChangeText={setUsernameInput}
        autoCapitalize="none"
      />

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
        onPress={handleRegisterPress}
        disabled={isLoading}
      >
        <Text style={styles.primaryButtonText}>
          {isLoading ? 'Creating account...' : 'Register'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => onNavigate('login')}>
        <Text style={styles.navigationLink}>
          Already have an account? Login
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