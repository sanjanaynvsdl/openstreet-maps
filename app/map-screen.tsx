import React, { useEffect, useRef, useState } from 'react';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import { fetchRoute, sendLocationToServer, cleanupWebSocket, RouteResponse, RouteInfo, formatDistance, formatDuration } from './utils/mapUtils';

const LOCATION_TASK_NAME = 'background-location-task';

// Define background location task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Error in background location task:', error);
    return;
  }
  
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];
    await sendLocationToServer(location);
  }
});

// Destination: MG Road, Bengaluru
const DESTINATION = {
  latitude: 16.2253,
  longitude: 77.8097,
};

export default function MapScreen() {
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [initialLocation, setInitialLocation] = useState<Location.LocationObject | null>(null);
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isWebViewReady, setIsWebViewReady] = useState(false);

  // Handle WebView load
  const handleWebViewLoad = () => {
    setIsWebViewReady(true);
  };

  // Send location to WebView when both WebView is ready and we have initial location
  useEffect(() => {
    if (isWebViewReady && initialLocation) {
      webViewRef.current?.postMessage(JSON.stringify({
        latitude: initialLocation.coords.latitude,
        longitude: initialLocation.coords.longitude,
        isInitialLocation: true
      }));
    }
  }, [isWebViewReady, initialLocation]);

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    (async () => {
      // Request both foreground and background permissions
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        console.error('Foreground location permission denied');
        return;
      }

      try {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus !== 'granted') {
          console.log('Background location permission denied');
        }
      } catch (error) {
        console.log('Error requesting background permission:', error);
      }

      // Get initial location
      const location = await Location.getCurrentPositionAsync({});
      setInitialLocation(location);
      await sendLocationToServer(location);
      
      // Get initial route
      try {
        const routeData = await fetchRoute(
          [location.coords.longitude, location.coords.latitude],
          [DESTINATION.longitude, DESTINATION.latitude]
        );
        setRoute(routeData);
        setRouteInfo({
          distance: formatDistance(routeData.distance),
          duration: formatDuration(routeData.duration)
        });
      } catch (error) {
        console.error('Error fetching initial route:', error);
      }

      setIsLoading(false);

      // Start foreground location updates
      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000,
          distanceInterval: 10,
        },
        async (newLocation) => {
          await sendLocationToServer(newLocation);
          
          try {
            const routeData = await fetchRoute(
              [newLocation.coords.longitude, newLocation.coords.latitude],
              [DESTINATION.longitude, DESTINATION.latitude]
            );
            setRoute(routeData);
            setRouteInfo({
              distance: formatDistance(routeData.distance),
              duration: formatDuration(routeData.duration)
            });

            // Send location and route to WebView
            webViewRef.current?.postMessage(JSON.stringify({
              latitude: newLocation.coords.latitude,
              longitude: newLocation.coords.longitude,
              routeCoords: routeData.coordinates
            }));
          } catch (error) {
            console.error('Error updating route:', error);
          }
        }
      );

      // Start background location updates if permission was granted
      try {
        const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (!hasStarted) {
          await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 10000,
            distanceInterval: 10,
            showsBackgroundLocationIndicator: true,
            foregroundService: {
              notificationTitle: "Location Tracking",
              notificationBody: "Your location is being tracked",
            },
          });
        }
      } catch (error) {
        console.error('Failed to start background location updates:', error);
      }
    })();

    // Cleanup
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
      
      (async () => {
        try {
          const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
          if (hasStarted) {
            await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
          }
        } catch (error) {
          console.error('Error stopping background location:', error);
        }
      })();

      cleanupWebSocket();
    };
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#631235" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={require('../osm.html')}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        style={styles.webview}
        onLoad={handleWebViewLoad}
      />
      {routeInfo && (
        <View style={styles.routeInfoContainer}>
          <View style={styles.routeInfoRow}>
            <Text style={styles.routeInfoLabel}>Distance:</Text>
            <Text style={styles.routeInfoValue}>{routeInfo.distance}</Text>
          </View>
          <View style={styles.routeInfoRow}>
            <Text style={styles.routeInfoLabel}>Duration:</Text>
            <Text style={styles.routeInfoValue}>{routeInfo.duration}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webview: {
    flex: 1,
  },
  routeInfoContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  routeInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  routeInfoLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#631235',
  },
  routeInfoValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#631235',
  },
}); 