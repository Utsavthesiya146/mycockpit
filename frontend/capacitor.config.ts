import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mycockpit.ai',
  appName: 'MY COCKPIT AI',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#FFFFFF',
      showSpinner: false
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#FFFFFF'
    }
  }
};

export default config;
