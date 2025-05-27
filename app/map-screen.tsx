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
  latitude: 12.9352,
  longitude: 77.6245,
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

       // Request background permission explicitly
  try {
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      console.log('Background location permission denied');
      // You might want to show a message to the user here
    } else {
      console.log('Background location permission granted');
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
        source={{ 
          uri: "data:text/html;base64,PCFET0NUWVBFIGh0bWw+DQo8aHRtbD4NCjxoZWFkPg0KICA8dGl0bGU+T1NNIE1hcDwvdGl0bGU+DQogIDxtZXRhIG5hbWU9InZpZXdwb3J0IiBjb250ZW50PSJ3aWR0aD1kZXZpY2Utd2lkdGgsIGluaXRpYWwtc2NhbGU9MS4wIj4NCiAgPGxpbmsNCiAgICByZWw9InN0eWxlc2hlZXQiDQogICAgaHJlZj0iaHR0cHM6Ly91bnBrZy5jb20vbGVhZmxldEAxLjkuNC9kaXN0L2xlYWZsZXQuY3NzIg0KICAvPg0KICA8c3R5bGU+DQogICAgaHRtbCwgYm9keSwgI21hcCB7DQogICAgICBoZWlnaHQ6IDEwMCU7DQogICAgICBtYXJnaW46IDA7DQogICAgfQ0KICAgICNlcnJvci1tZXNzYWdlIHsNCiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTsNCiAgICAgIHRvcDogMDsNCiAgICAgIGxlZnQ6IDA7DQogICAgICByaWdodDogMDsNCiAgICAgIGJhY2tncm91bmQtY29sb3I6IHJnYmEoMjU1LCAwLCAwLCAwLjcpOw0KICAgICAgY29sb3I6IHdoaXRlOw0KICAgICAgcGFkZGluZzogMTBweDsNCiAgICAgIHotaW5kZXg6IDEwMDA7DQogICAgICBkaXNwbGF5OiBub25lOw0KICAgIH0NCiAgPC9zdHlsZT4NCjwvaGVhZD4NCjxib2R5Pg0KICA8ZGl2IGlkPSJlcnJvci1tZXNzYWdlIj48L2Rpdj4NCiAgPGRpdiBpZD0ibWFwIj48L2Rpdj4NCg0KICA8c2NyaXB0IHNyYz0iaHR0cHM6Ly91bnBrZy5jb20vbGVhZmxldEAxLjkuNC9kaXN0L2xlYWZsZXQuanMiPjwvc2NyaXB0Pg0KDQogIDxzY3JpcHQ+DQogICAgLy8gSW5pdGlhbGl6ZSBlcnJvciBsb2dnaW5nDQogICAgY29uc29sZS5lcnJvciA9IGZ1bmN0aW9uKCkgew0KICAgICAgY29uc3QgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7DQogICAgICBjb25zdCBlcnJvck1zZyA9IGFyZ3Muam9pbignICcpOw0KICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Vycm9yLW1lc3NhZ2UnKS50ZXh0Q29udGVudCA9IGVycm9yTXNnOw0KICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Vycm9yLW1lc3NhZ2UnKS5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJzsNCiAgICAgIC8vIFBhc3MgdG8gb3JpZ2luYWwgY29uc29sZS5lcnJvcg0KICAgICAgd2luZG93Lm9yaWdpbmFsQ29uc29sZUVycm9yID0gd2luZG93Lm9yaWdpbmFsQ29uc29sZUVycm9yIHx8IGNvbnNvbGUuZXJyb3I7DQogICAgICB3aW5kb3cub3JpZ2luYWxDb25zb2xlRXJyb3IuYXBwbHkoY29uc29sZSwgYXJncyk7DQogICAgfTsNCg0KICAgIC8vIENoZWNrIHByb3RvY29sDQogICAgY29uc29sZS5sb2coJ1BhZ2UgbG9hZGVkIHdpdGggcHJvdG9jb2w6Jywgd2luZG93LmxvY2F0aW9uLnByb3RvY29sKTsNCiAgICANCiAgICBsZXQgbWFwID0gbnVsbDsNCiAgICBsZXQgdXNlck1hcmtlciA9IG51bGw7DQogICAgbGV0IGRlc3RpbmF0aW9uTWFya2VyID0gbnVsbDsNCiAgICBsZXQgcm91dGVMaW5lID0gbnVsbDsNCiAgICANCiAgICAvLyBBZGQgZXJyb3IgaGFuZGxpbmcNCiAgICBmdW5jdGlvbiBzaG93RXJyb3IobWVzc2FnZSkgew0KICAgICAgY29uc3QgZXJyb3JFbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdlcnJvci1tZXNzYWdlJyk7DQogICAgICBlcnJvckVsLnRleHRDb250ZW50ID0gbWVzc2FnZTsNCiAgICAgIGVycm9yRWwuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7DQogICAgICBjb25zb2xlLmVycm9yKG1lc3NhZ2UpOw0KICAgIH0NCg0KICAgIC8vIEZ1bmN0aW9uIHRvIGluaXRpYWxpemUgbWFwIHdpdGggdXNlciBsb2NhdGlvbg0KICAgIGZ1bmN0aW9uIGluaXRpYWxpemVNYXAobGF0aXR1ZGUsIGxvbmdpdHVkZSkgew0KICAgICAgdHJ5IHsNCiAgICAgICAgaWYgKCFtYXApIHsNCiAgICAgICAgICBtYXAgPSBMLm1hcCgnbWFwJykuc2V0VmlldyhbbGF0aXR1ZGUsIGxvbmdpdHVkZV0sIDE1KTsgLy8gSW5jcmVhc2VkIHpvb20gbGV2ZWwNCiAgICAgICAgICANCiAgICAgICAgICAvLyBUcnkgdXNpbmcgSFRUUFMgZXhwbGljaXRseSB3aXRoIGVycm9yIGhhbmRsaW5nDQogICAgICAgICAgY29uc3QgdGlsZUxheWVyID0gTC50aWxlTGF5ZXIoJ2h0dHBzOi8ve3N9LnRpbGUub3BlbnN0cmVldG1hcC5vcmcve3p9L3t4fS97eX0ucG5nJywgew0KICAgICAgICAgICAgbWF4Wm9vbTogMTksDQogICAgICAgICAgICBhdHRyaWJ1dGlvbjogJ8KpIE9wZW5TdHJlZXRNYXAnLA0KICAgICAgICAgICAgc3ViZG9tYWluczogWydhJywgJ2InLCAnYyddLA0KICAgICAgICAgICAgY3Jvc3NPcmlnaW46IHRydWUNCiAgICAgICAgICB9KS5hZGRUbyhtYXApOw0KICAgICAgICAgIA0KICAgICAgICAgIHRpbGVMYXllci5vbigndGlsZWVycm9yJywgZnVuY3Rpb24oZSkgew0KICAgICAgICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIGxvYWQgdGlsZTonLCBlLnRpbGUsICdFcnJvcjonLCBlLmVycm9yKTsNCiAgICAgICAgICAgIHNob3dFcnJvcignVGlsZSBsb2FkaW5nIGVycm9yLiBUcnkgdXNpbmcgYSBkaWZmZXJlbnQgbmV0d29yay4nKTsNCiAgICAgICAgICAgIA0KICAgICAgICAgICAgLy8gVHJ5IGZhbGxiYWNrIHRpbGUgc2VydmVyIGlmIHByaW1hcnkgZmFpbHMNCiAgICAgICAgICAgIGlmICghbWFwLl9mYWxsYmFja1RpbGVBdHRlbXB0ZWQpIHsNCiAgICAgICAgICAgICAgbWFwLl9mYWxsYmFja1RpbGVBdHRlbXB0ZWQgPSB0cnVlOw0KICAgICAgICAgICAgICBjb25zb2xlLmxvZygnQXR0ZW1wdGluZyBmYWxsYmFjayB0aWxlIHNlcnZlci4uLicpOw0KICAgICAgICAgICAgICANCiAgICAgICAgICAgICAgLy8gVHJ5IE1hcGJveCBhcyBmYWxsYmFjayAoaWYgZmFpbHMsIGNhbiB0cnkgb3RoZXJzKQ0KICAgICAgICAgICAgICBMLnRpbGVMYXllcignaHR0cHM6Ly9hcGkubWFwYm94LmNvbS9zdHlsZXMvdjEvbWFwYm94L3N0cmVldHMtdjExL3RpbGVzL3t6fS97eH0ve3l9P2FjY2Vzc190b2tlbj1way5leUoxSWpvaWMyRnVhbUZ1WVhsdWRuTmtiQ0lzSW1FaU9pSmpiV0ZuWjJoNFlUTXdNSFZ5TW10ek4yeG9aWGcxTm1Od0luMC5Nb255bXpwM3VvRVh1ZmM5NXl3S2NBJywgew0KICAgICAgICAgICAgICAgIG1heFpvb206IDE5LA0KICAgICAgICAgICAgICAgIGF0dHJpYnV0aW9uOiAnwqkgTWFwYm94JywNCiAgICAgICAgICAgICAgICBjcm9zc09yaWdpbjogdHJ1ZQ0KICAgICAgICAgICAgICB9KS5hZGRUbyhtYXApOw0KICAgICAgICAgICAgfQ0KICAgICAgICAgIH0pOw0KDQogICAgICAgICAgLy8gQ3JlYXRlIGN1c3RvbSBpY29ucw0KICAgICAgICAgIGNvbnN0IHVzZXJJY29uID0gTC5kaXZJY29uKHsNCiAgICAgICAgICAgIGNsYXNzTmFtZTogJ3VzZXItbWFya2VyJywNCiAgICAgICAgICAgIGh0bWw6ICc8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kLWNvbG9yOiAjNDQ3YmQ1OyB3aWR0aDogMTJweDsgaGVpZ2h0OiAxMnB4OyBib3JkZXItcmFkaXVzOiA1MCU7IGJvcmRlcjogMnB4IHNvbGlkIHdoaXRlOyI+PC9kaXY+JywNCiAgICAgICAgICAgIGljb25TaXplOiBbMTYsIDE2XQ0KICAgICAgICAgIH0pOw0KDQogICAgICAgICAgY29uc3QgZGVzdGluYXRpb25JY29uID0gTC5kaXZJY29uKHsNCiAgICAgICAgICAgIGNsYXNzTmFtZTogJ2Rlc3RpbmF0aW9uLW1hcmtlcicsDQogICAgICAgICAgICBodG1sOiAnPGRpdiBzdHlsZT0iYmFja2dyb3VuZC1jb2xvcjogI2I0MjEyMTsgd2lkdGg6IDEycHg7IGhlaWdodDogMTJweDsgYm9yZGVyLXJhZGl1czogNTAlOyBib3JkZXI6IDJweCBzb2xpZCB3aGl0ZTsiPjwvZGl2PicsDQogICAgICAgICAgICBpY29uU2l6ZTogWzE2LCAxNl0NCiAgICAgICAgICB9KTsNCg0KICAgICAgICAgIC8vIEluaXRpYWxpemUgb25seSB1c2VyIG1hcmtlciBpbml0aWFsbHkNCiAgICAgICAgICB1c2VyTWFya2VyID0gTC5tYXJrZXIoW2xhdGl0dWRlLCBsb25naXR1ZGVdLCB7IGljb246IHVzZXJJY29uIH0pDQogICAgICAgICAgICAuYWRkVG8obWFwKQ0KICAgICAgICAgICAgLmJpbmRQb3B1cCgiWW91IikNCiAgICAgICAgICAgIC5vcGVuUG9wdXAoKTsNCg0KICAgICAgICAgIC8vIENlbnRlciBtYXAgb24gdXNlciBsb2NhdGlvbg0KICAgICAgICAgIG1hcC5zZXRWaWV3KFtsYXRpdHVkZSwgbG9uZ2l0dWRlXSwgMTUpOw0KICAgICAgICB9DQogICAgICB9IGNhdGNoIChlcnJvcikgew0KICAgICAgICBzaG93RXJyb3IoJ01hcCBpbml0aWFsaXphdGlvbiBlcnJvcjogJyArIGVycm9yLm1lc3NhZ2UpOw0KICAgICAgfQ0KICAgIH0NCg0KICAgIC8vIEZ1bmN0aW9uIHRvIHVwZGF0ZSBkZXN0aW5hdGlvbiBtYXJrZXINCiAgICBmdW5jdGlvbiB1cGRhdGVEZXN0aW5hdGlvbk1hcmtlcihsYXRpdHVkZSwgbG9uZ2l0dWRlKSB7DQogICAgICB0cnkgew0KICAgICAgICBpZiAoIW1hcCkgcmV0dXJuOw0KDQogICAgICAgIGNvbnN0IGRlc3RpbmF0aW9uSWNvbiA9IEwuZGl2SWNvbih7DQogICAgICAgICAgY2xhc3NOYW1lOiAnZGVzdGluYXRpb24tbWFya2VyJywNCiAgICAgICAgICBodG1sOiAnPGRpdiBzdHlsZT0iYmFja2dyb3VuZC1jb2xvcjogI2I0MjEyMTsgd2lkdGg6IDEycHg7IGhlaWdodDogMTJweDsgYm9yZGVyLXJhZGl1czogNTAlOyBib3JkZXI6IDJweCBzb2xpZCB3aGl0ZTsiPjwvZGl2PicsDQogICAgICAgICAgaWNvblNpemU6IFsxNiwgMTZdDQogICAgICAgIH0pOw0KDQogICAgICAgIC8vIFJlbW92ZSBleGlzdGluZyBkZXN0aW5hdGlvbiBtYXJrZXIgaWYgYW55DQogICAgICAgIGlmIChkZXN0aW5hdGlvbk1hcmtlcikgew0KICAgICAgICAgIG1hcC5yZW1vdmVMYXllcihkZXN0aW5hdGlvbk1hcmtlcik7DQogICAgICAgIH0NCg0KICAgICAgICAvLyBBZGQgbmV3IGRlc3RpbmF0aW9uIG1hcmtlcg0KICAgICAgICBkZXN0aW5hdGlvbk1hcmtlciA9IEwubWFya2VyKFtsYXRpdHVkZSwgbG9uZ2l0dWRlXSwgeyBpY29uOiBkZXN0aW5hdGlvbkljb24gfSkNCiAgICAgICAgICAuYWRkVG8obWFwKQ0KICAgICAgICAgIC5iaW5kUG9wdXAoIkRlc3RpbmF0aW9uIikNCiAgICAgICAgICAub3BlblBvcHVwKCk7DQogICAgICB9IGNhdGNoIChlcnJvcikgew0KICAgICAgICBzaG93RXJyb3IoJ0Rlc3RpbmF0aW9uIG1hcmtlciBlcnJvcjogJyArIGVycm9yLm1lc3NhZ2UpOw0KICAgICAgfQ0KICAgIH0NCg0KICAgIC8vIEhhbmRsZSBtZXNzYWdlcyBmcm9tIFJlYWN0IE5hdGl2ZQ0KICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoIm1lc3NhZ2UiLCBmdW5jdGlvbiAoZXZlbnQpIHsNCiAgICAgIHRyeSB7DQogICAgICAgIGNvbnNvbGUubG9nKCdSZWNlaXZlZCBtZXNzYWdlOicsIGV2ZW50LmRhdGEpOw0KICAgICAgICBjb25zdCBkYXRhID0gSlNPTi5wYXJzZShldmVudC5kYXRhKTsNCiAgICAgICAgY29uc3QgeyBsYXRpdHVkZSwgbG9uZ2l0dWRlLCByb3V0ZUNvb3JkcywgaXNJbml0aWFsTG9jYXRpb24gfSA9IGRhdGE7DQoNCiAgICAgICAgaWYgKGlzSW5pdGlhbExvY2F0aW9uKSB7DQogICAgICAgICAgaW5pdGlhbGl6ZU1hcChsYXRpdHVkZSwgbG9uZ2l0dWRlKTsNCiAgICAgICAgfSBlbHNlIHsNCiAgICAgICAgICAvLyBVcGRhdGUgdXNlciBtYXJrZXIgcG9zaXRpb24NCiAgICAgICAgICB1c2VyTWFya2VyPy5zZXRMYXRMbmcoW2xhdGl0dWRlLCBsb25naXR1ZGVdKTsNCg0KICAgICAgICAgIC8vIFVwZGF0ZSByb3V0ZSBhbmQgZGVzdGluYXRpb24NCiAgICAgICAgICBpZiAocm91dGVDb29yZHMgJiYgcm91dGVDb29yZHMubGVuZ3RoID4gMSkgew0KICAgICAgICAgICAgLy8gVXBkYXRlIGRlc3RpbmF0aW9uIG1hcmtlciB1c2luZyB0aGUgbGFzdCBjb29yZGluYXRlIG9mIHRoZSByb3V0ZQ0KICAgICAgICAgICAgY29uc3QgbGFzdENvb3JkID0gcm91dGVDb29yZHNbcm91dGVDb29yZHMubGVuZ3RoIC0gMV07DQogICAgICAgICAgICB1cGRhdGVEZXN0aW5hdGlvbk1hcmtlcihsYXN0Q29vcmRbMV0sIGxhc3RDb29yZFswXSk7DQoNCiAgICAgICAgICAgIC8vIFVwZGF0ZSByb3V0ZSBsaW5lDQogICAgICAgICAgICBpZiAocm91dGVMaW5lKSB7DQogICAgICAgICAgICAgIG1hcC5yZW1vdmVMYXllcihyb3V0ZUxpbmUpOw0KICAgICAgICAgICAgfQ0KDQogICAgICAgICAgICByb3V0ZUxpbmUgPSBMLnBvbHlsaW5lKHJvdXRlQ29vcmRzLm1hcChjb29yZCA9PiBbY29vcmRbMV0sIGNvb3JkWzBdXSksIHsNCiAgICAgICAgICAgICAgY29sb3I6ICcjNjMxMjM1JywNCiAgICAgICAgICAgICAgd2VpZ2h0OiA1LA0KICAgICAgICAgICAgICBvcGFjaXR5OiAwLjgNCiAgICAgICAgICAgIH0pLmFkZFRvKG1hcCk7DQoNCiAgICAgICAgICAgIC8vIEZpdCBtYXAgdG8gc2hvdyBib3RoIG1hcmtlcnMgYW5kIHJvdXRlDQogICAgICAgICAgICBjb25zdCBib3VuZHMgPSByb3V0ZUxpbmUuZ2V0Qm91bmRzKCkuZXh0ZW5kKGRlc3RpbmF0aW9uTWFya2VyLmdldExhdExuZygpKTsNCiAgICAgICAgICAgIG1hcC5maXRCb3VuZHMoYm91bmRzLCB7IHBhZGRpbmc6IFs1MCwgNTBdIH0pOw0KICAgICAgICAgIH0NCiAgICAgICAgfQ0KICAgICAgfSBjYXRjaCAoZSkgew0KICAgICAgICBzaG93RXJyb3IoJ0Vycm9yIHByb2Nlc3NpbmcgbWVzc2FnZTogJyArIGUubWVzc2FnZSk7DQogICAgICB9DQogICAgfSk7DQoNCiAgICAvLyBEZWJ1ZyBpbml0aWFsaXphdGlvbiAtIHRoaXMgd2lsbCBydW4gZXZlbiBpZiBubyBtZXNzYWdlcyBhcmUgcmVjZWl2ZWQNCiAgICB3aW5kb3cub25lcnJvciA9IGZ1bmN0aW9uKG1lc3NhZ2UsIHNvdXJjZSwgbGluZW5vLCBjb2xubywgZXJyb3IpIHsNCiAgICAgIHNob3dFcnJvcihgSmF2YVNjcmlwdCBlcnJvcjogJHttZXNzYWdlfWApOw0KICAgICAgcmV0dXJuIHRydWU7DQogICAgfTsNCg0KICAgIC8vIFNlbmQgcmVhZHkgbWVzc2FnZSB0byBSZWFjdCBOYXRpdmUNCiAgICB0cnkgew0KICAgICAgd2luZG93LlJlYWN0TmF0aXZlV2ViVmlldz8ucG9zdE1lc3NhZ2UoSlNPTi5zdHJpbmdpZnkoe3R5cGU6ICdyZWFkeSd9KSk7DQogICAgfSBjYXRjaCAoZSkgew0KICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIHNlbmQgcmVhZHkgbWVzc2FnZTonLCBlKTsNCiAgICB9DQogIDwvc2NyaXB0Pg0KPC9ib2R5Pg0KPC9odG1sPg0K" 
        }}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccess={true}
        mixedContentMode="always"
        androidLayerType="hardware"
        onShouldStartLoadWithRequest={() => true}
        startInLoadingState={true}
        onError={(error) => console.error('WebView error:', error)}
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