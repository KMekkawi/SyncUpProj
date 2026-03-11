// config.js
// Central configuration file for the SyncUp mobile application
// Storing the API URL here means it only needs to be updated in one place
// when the backend address changes e.g. when switching between development
// and production environments

// The IP address must match the machine running the Flask backend
// Port 8000 is used to avoid conflict with macOS AirPlay which uses port 5000
const BACKEND_URL = 'http://192.168.1.98:8000';

//const BACKEND_URL = 'http://127.0.0.1:8000';


export default BACKEND_URL;