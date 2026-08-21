import 'next-intl';

declare module 'next-intl' {
  // tipe key pesan, sesuaikan dengan pesan yang kamu punya
  interface Messages {
    welcome: string;
    'home.title': string;
  }
}
