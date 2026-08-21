type CapacitorConfig = {
  appId: string;
  appName: string;
  webDir: string;
  server?: {
    url: string;
    cleartext?: boolean;
  };
};

const config: CapacitorConfig = {
  appId: 'com.lajukan.app',
  appName: 'Lajukan',
  webDir: 'build', // tetap harus ada, tapi bisa kosong
  server: {
    url: "https://www.lajukan.com", // <-- live URL
    cleartext: false
  }
};

export default config;
