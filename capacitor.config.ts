import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chodinglife.app',
  appName: '초딩생활',
  webDir: 'build',
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com']
    }
  }
};

export default config;
