import 'dotenv/config';
// app.config.js

export default ({ config }) => ({
    ...config,
    name: "rider-osm",
    slug: "rider-osm",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "riderosm",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
      package: "com.sanjana1209.riderosm",
      permissions: [
        "ACCESS_FINE_LOCATION", 
        "ACCESS_COARSE_LOCATION", 
        "ACCESS_BACKGROUND_LOCATION",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION"
      ],
      config: {
    usesCleartextTraffic: true,
    networkSecurityConfig: './network_security_config.xml'
  },
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
        },
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Allow Rider  to use your location for navigation and tracking.",
          locationAlwaysPermission: "Allow Rider to use your location in the background.",
          isIosBackgroundLocationEnabled: true,
          isAndroidBackgroundLocationEnabled: true
        }
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      MAPBOX_API_KEY: process.env.MAPBOX_API_KEY,
      router: {},
      eas: {
        projectId: "f591479d-b237-49ae-9c65-c9ba32756444"
      }
      
    },
  });
  