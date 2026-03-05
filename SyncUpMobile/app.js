import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button } from 'react-native';
import { useState } from 'react';

export default function App() {
  const [message, setMessage] = useState('Press button to test backend');
  const [loading, setLoading] = useState(false);

  const testBackend = async () => {
    setLoading(true);
    try {

      const response = await fetch('http://192.168.83.8:5000/api/test');
      const data = await response.json();
      setMessage('✅ ' + data.data);
    } catch (error) {
      setMessage('❌ Error: ' + error.message);
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🗓️ SyncUp Calendar</Text>
      <Text style={styles.subtitle}>Full Stack Mobile App</Text>
      
      <View style={styles.messageBox}>
        <Text style={styles.message}>{message}</Text>
      </View>
      
      <Button 
        title={loading ? "Testing..." : "Test Backend Connection"} 
        onPress={testBackend}
        disabled={loading}
      />
      
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
  },
  messageBox: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    marginBottom: 30,
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
  },
});