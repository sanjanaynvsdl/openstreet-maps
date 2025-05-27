import { io, Socket } from 'socket.io-client';
import * as Location from 'expo-location';
import Constants from 'expo-constants';

// const MAPBOX_TOKEN = Constants.expoConfig?.extra?.MAPBOX_API_KEY;
const MAPBOX_TOKEN = "pk.eyJ1Ijoic2FuamFuYXludnNkbCIsImEiOiJjbWFnZ2h4YTMwMHVyMmtzN2xoZXg1NmNwIn0.Monymzp3uoEXufc95ywKcA";
console.log("MAPBOX_TOKEN:", MAPBOX_TOKEN);

export interface RouteResponse {
  coordinates: [number, number][];
  distance: number;
  duration: number;
}

export interface RouteInfo {
  distance: string;
  duration: string;
}

export const formatDistance = (meters: number): string => {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
};

export const formatDuration = (seconds: number): string => {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
};

// export const fetchRoute = async (start: [number, number], end: [number, number]): Promise<RouteResponse> => {
//   const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;

//   try {
//     const res = await fetch(url);
//     const json = await res.json();
//     const route = json.routes[0];
//     return {
//       coordinates: route.geometry.coordinates,
//       distance: route.distance,
//       duration: route.duration
//     };
//   } catch (err) {
//     console.error('Error fetching route:', err);
//     throw err;
//   }
// };

export const fetchRoute = async (start: [number, number], end: [number, number]): Promise<RouteResponse> => {
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;

  try {
    console.log("Fetching route with URL:", url);
    const res = await fetch(url);
    const json = await res.json();
    console.log("Route API response:", JSON.stringify(json));
    
    // Check if the response has the expected structure
    if (!json.routes || !json.routes[0]) {
      console.error("Invalid route response:", json);
      throw new Error("Invalid route response from Mapbox");
    }
    
    const route = json.routes[0];
    return {
      coordinates: route.geometry.coordinates,
      distance: route.distance,
      duration: route.duration
    };
  } catch (err) {
    console.error('Error fetching route details:', err);
    // Provide fallback/default response
    return {
      coordinates: [[end[0], end[1]], [start[0], start[1]]], 
      distance: 0,
      duration: 0
    };
  }
};

let socket: Socket | null = null;

export const initializeWebSocket = () => {
  if (!socket) {
    socket = io('https://ws-maps.onrender.com');
    
    socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });
  }
  return socket;
};

export const sendLocationToServer = async (location: Location.LocationObject): Promise<void> => {
  try {
    if (!socket) {
      socket = initializeWebSocket();
    }

    if (socket.connected) {
      console.log('Sending location to server:', location);
      socket.emit('location', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp
      });
    } else {
      console.log('Socket not connected, attempting to reconnect...');
      socket.connect();
    }
  } catch (error) {
    console.error('Failed to send location:', error);
  }
};

export const cleanupWebSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}; 