# Lajukan Usaha Mobile

Flutter WebView shell khusus untuk **Lajukan Usaha**.

Aplikasi membuka:

`https://usaha.lajukan.com`

dengan kemampuan native yang sama dengan shell Lajukan utama: WebView JavaScript, upload media, kamera/mikrofon, geolocation, external app links, system back, retry saat halaman gagal, dan mode ringan untuk menjaga WebView tetap responsif.

## Identitas

- Android package: `com.lajukan.usaha`
- iOS bundle identifier: `com.lajukan.usaha`
- Source: `frontend/apps/mobile/lajukan_usaha_webview`

## Test lokal

Dari root repository:

```bash
cd frontend/apps/mobile/lajukan_usaha_webview
flutter pub get
dart run flutter_launcher_icons
flutter analyze
flutter test
```

Jalankan di Android:

```bash
flutter run
```

Generate APK release:

```bash
flutter build apk --release
```

Hasil:

```
build/app/outputs/flutter-apk/app-release.apk
```

Untuk debug/smoke test perangkat lokal:

```bash
flutter install
```

## GitHub Actions

Workflow:

`.github/workflows/mobile-flutter-usaha.yml`

Setiap push/PR yang menyentuh project Usaha akan menjalankan:

1. `flutter pub get`
2. generate launcher icon
3. `flutter analyze`
4. `flutter test`
5. `flutter build apk --release`
6. upload artifact `lajukan-usaha-android-release-apk`

Jadi APK preview bisa diambil dari **GitHub Actions → workflow run → Artifacts** lalu dikirim langsung ke tester.

## Codemagic

`codemagic.yaml` memiliki workflow:

`android-preview-usaha`

Workflow menghasilkan APK installable untuk dibagikan langsung.

Artifact:

`build/app/outputs/flutter-apk/*.apk`

Untuk Play Store, gunakan signing key terpisah untuk package `com.lajukan.usaha`. Jangan pernah memasukkan keystore atau password ke Git.

## Distribusi APK ke HP

Untuk tester internal, alurnya:

```
Push perubahan ke main
        ↓
GitHub Actions / Codemagic build
        ↓
Download app-release.apk
        ↓
Kirim APK via WhatsApp / Telegram / Drive
        ↓
Tester install
```

Android mungkin meminta izin **Install unknown apps** saat memasang APK dari chat/file manager.

Untuk rilis publik Google Play, gunakan **AAB signed**, bukan APK preview.

## Catatan WebView

Shell ini sengaja mempertahankan implementasi native dari Lajukan WebView utama agar:

- upload foto/video dari halaman Usaha tetap bekerja;
- permission kamera, mikrofon, dan lokasi tetap ditangani native;
- link `tel:`, `mailto:`, WhatsApp, Telegram, Maps, dan scheme eksternal dapat dibuka oleh aplikasi yang sesuai;
- tombol Back Android menavigasikan history WebView sebelum menutup aplikasi;
- kegagalan jaringan menampilkan kontrol muat ulang;
- animasi/background blur berat dikurangi di dalam WebView agar perangkat kelas menengah tetap ringan.
