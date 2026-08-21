import 'package:flutter/foundation.dart';
import 'dart:async';
import 'dart:convert';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

var _homeUri = Uri.parse('https://www.lajukan.com');
const String _permissionsChannelName = 'LajukanPermissions';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const LajukanApp());
}

class LajukanApp extends StatelessWidget {
  const LajukanApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Lajukan',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0B5FFF)),
        useMaterial3: true,
      ),
      home: const LajukanWebView(),
    );
  }
}

class LajukanWebView extends StatefulWidget {
  const LajukanWebView({super.key});

  @override
  State<LajukanWebView> createState() => _LajukanWebViewState();
}

class _LajukanWebViewState extends State<LajukanWebView> {
  late final WebViewController _controller;
  late final Widget _webView;
  final ValueNotifier<double> _progress = ValueNotifier(0);
  bool _handlingSystemBack = false;
  String? _errorMessage;

  Future<void> _handlePermissionRequest(
    PlatformWebViewPermissionRequest request,
  ) async {
    if (!mounted) {
      await request.deny();
      return;
    }

    final permissions = <Permission>[];
    if (request.types.contains(WebViewPermissionResourceType.camera)) {
      permissions.add(Permission.camera);
    }
    if (request.types.contains(WebViewPermissionResourceType.microphone)) {
      permissions.add(Permission.microphone);
    }

    if (permissions.isEmpty) {
      await request.grant();
      return;
    }

    final result = await _requestPermissions(permissions);
    if (result.granted) {
      await request.grant();
      return;
    }

    await request.deny();
    if (!mounted) return;

    if (result.shouldOpenSettings) {
      await _showSettingsDialog(
        title: 'Izin kamera/mikrofon diblokir',
        message:
            'Buka pengaturan perangkat untuk mengizinkan akses kamera '
            'dan mikrofon agar panggilan bisa berjalan.',
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Izin kamera/mikrofon ditolak. Cek pengaturan izin.'),
        ),
      );
    }
  }

  Future<GeolocationPermissionsResponse> _handleGeolocationPrompt(
    GeolocationPermissionsRequestParams request,
  ) async {
    final status = await _requestLocationPermission();
    final allow = status.isGranted;
    if (!allow && mounted) {
      if (status.isPermanentlyDenied || status.isRestricted) {
        await _showSettingsDialog(
          title: 'Izin lokasi diblokir',
          message: 'Buka pengaturan perangkat untuk mengizinkan akses lokasi.',
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Izin lokasi ditolak. Cek pengaturan izin.'),
          ),
        );
      }
    }
    return GeolocationPermissionsResponse(allow: allow, retain: allow);
  }

  bool get _supportsWebView {
    if (kIsWeb) {
      return false;
    }
    return defaultTargetPlatform == TargetPlatform.android ||
        defaultTargetPlatform == TargetPlatform.iOS ||
        defaultTargetPlatform == TargetPlatform.macOS;
  }

  @override
  void initState() {
    super.initState();
    if (_supportsWebView) {
      final PlatformWebViewControllerCreationParams params =
          const PlatformWebViewControllerCreationParams();
      _controller = WebViewController.fromPlatformCreationParams(params);

      if (_controller.platform is AndroidWebViewController) {
        final AndroidWebViewController androidController =
            _controller.platform as AndroidWebViewController;
        androidController.setMediaPlaybackRequiresUserGesture(false);
        androidController.setGeolocationEnabled(true);
        androidController.setBackgroundColor(const Color(0xFF0B1220));
        androidController.setOnPlatformPermissionRequest((request) {
          unawaited(_handlePermissionRequest(request));
        });
        androidController.setGeolocationPermissionsPromptCallbacks(
          onShowPrompt: _handleGeolocationPrompt,
        );
      }

      _controller
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..addJavaScriptChannel(
          _permissionsChannelName,
          onMessageReceived: _handleNativeMessage,
        )
        ..setNavigationDelegate(
          NavigationDelegate(
            onProgress: (progress) {
              final next = progress / 100.0;
              if ((next - _progress.value).abs() >= 0.05 || next >= 1) {
                _progress.value = next.clamp(0, 1);
              }
            },
            onPageStarted: (_) {
              _progress.value = 0;
              setState(() => _errorMessage = null);
            },
            onPageFinished: (_) async {
              _progress.value = 1;
              await _controller.runJavaScript(_liteModeScript);
            },
            onWebResourceError: (error) {
              setState(() => _errorMessage = error.description);
            },
            onNavigationRequest: (request) async {
              final uri = Uri.tryParse(request.url);
              if (uri == null) {
                return NavigationDecision.navigate;
              }
              const externalSchemes = <String>{
                'tel',
                'mailto',
                'sms',
                'smsto',
                'mms',
                'mmsto',
                'geo',
                'intent',
                'whatsapp',
                'tg',
                'line',
              };
              if (externalSchemes.contains(uri.scheme)) {
                final ok = await launchUrl(
                  uri,
                  mode: LaunchMode.externalApplication,
                );
                if (!ok && mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Gagal membuka aplikasi.')),
                  );
                }
                return NavigationDecision.prevent;
              }
              return NavigationDecision.navigate;
            },
          ),
        )
        ..loadRequest(_homeUri);

      if (defaultTargetPlatform == TargetPlatform.android) {
        _webView = WebViewWidget.fromPlatformCreationParams(
          params: AndroidWebViewWidgetCreationParams(
            controller: _controller.platform as AndroidWebViewController,
            displayWithHybridComposition: true,
          ),
        );
      } else {
        _webView = WebViewWidget(controller: _controller);
      }
    }
  }

  @override
  void dispose() {
    _progress.dispose();
    super.dispose();
  }

  Future<void> _openExternal() async {
    final ok = await launchUrl(_homeUri, mode: LaunchMode.externalApplication);
    if (!ok && mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Gagal membuka browser.')));
    }
  }

  Future<bool> _canGoBackInsideWebApp() async {
    try {
      final result = await _controller.runJavaScriptReturningResult(
        'Boolean(window.history && window.history.length > 1)',
      );
      if (result is bool) return result;
      final text = result.toString().replaceAll('"', '').trim().toLowerCase();
      return text == 'true' || text == '1';
    } catch (_) {
      return false;
    }
  }

  Future<bool> _navigateBackOrShouldClose() async {
    if (await _controller.canGoBack()) {
      await _controller.goBack();
      return false;
    }

    if (await _canGoBackInsideWebApp()) {
      await _controller.runJavaScript('window.history.back();');
      return false;
    }

    return true;
  }

  Future<void> _handleSystemBack() async {
    if (_handlingSystemBack) return;
    _handlingSystemBack = true;

    try {
      final shouldClose = await _navigateBackOrShouldClose();
      if (shouldClose && mounted) {
        await SystemNavigator.pop();
      }
    } finally {
      _handlingSystemBack = false;
    }
  }

  Future<void> _handleNativeMessage(JavaScriptMessage message) async {
    if (!mounted) return;
    final raw = message.message.trim();
    if (raw.isEmpty) return;
    try {
      final payload = jsonDecode(raw);
      if (payload is Map<String, dynamic>) {
        final action = payload['action'];
        if (action == 'openSettings') {
          await openAppSettings();
          return;
        }
        if (action == 'requestPermissions') {
          final permissions = payload['permissions'];
          if (permissions is List) {
            final mapped = _mapPermissions(permissions);
            if (mapped.isNotEmpty) {
              final result = await _requestPermissions(mapped);
              if (!result.granted && result.shouldOpenSettings && mounted) {
                await _showSettingsDialog(
                  title: 'Izin diblokir',
                  message: 'Buka pengaturan perangkat untuk mengizinkan akses.',
                );
              }
            }
          }
          return;
        }
        if (action == 'openReelsStudio') {
          await _openReelsStudio();
          return;
        }
      }
    } catch (_) {
      if (raw == 'openSettings') {
        await openAppSettings();
      }
    }
  }

  Future<void> _openReelsStudio() async {
    final result = await Navigator.of(context).push<_ReelsStudioResult>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => const _ReelsStudioScreen(),
      ),
    );
    if (!mounted || result == null) return;

    final detail = jsonEncode(result.toJson());
    await _controller.runJavaScript('''
      window.dispatchEvent(new CustomEvent('lajukan-native-reels-capture', {
        detail: $detail
      }));
    ''');
  }

  List<Permission> _mapPermissions(List<dynamic> names) {
    final permissions = <Permission>[];
    for (final entry in names) {
      if (entry is! String) continue;
      switch (entry) {
        case 'camera':
          permissions.add(Permission.camera);
          break;
        case 'microphone':
          permissions.add(Permission.microphone);
          break;
        case 'location':
          permissions.add(Permission.location);
          break;
        case 'locationWhenInUse':
          permissions.add(Permission.locationWhenInUse);
          break;
        case 'locationAlways':
          permissions.add(Permission.locationAlways);
          break;
        case 'notifications':
          permissions.add(Permission.notification);
          break;
      }
    }
    return permissions;
  }

  Future<_PermissionRequestResult> _requestPermissions(
    List<Permission> permissions,
  ) async {
    if (permissions.isEmpty) {
      return const _PermissionRequestResult(
        granted: true,
        shouldOpenSettings: false,
      );
    }
    final statuses = await permissions.request();
    var granted = true;
    var shouldOpenSettings = false;
    for (final status in statuses.values) {
      granted = granted && (status.isGranted || status.isLimited);
      if (status.isPermanentlyDenied || status.isRestricted) {
        shouldOpenSettings = true;
      }
    }
    return _PermissionRequestResult(
      granted: granted,
      shouldOpenSettings: shouldOpenSettings,
    );
  }

  Future<PermissionStatus> _requestLocationPermission() async {
    if (defaultTargetPlatform == TargetPlatform.iOS ||
        defaultTargetPlatform == TargetPlatform.macOS) {
      return Permission.locationWhenInUse.request();
    }
    return Permission.location.request();
  }

  Future<void> _showSettingsDialog({
    required String title,
    required String message,
  }) async {
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: Text(title),
          content: Text(message),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Nanti'),
            ),
            FilledButton(
              onPressed: () async {
                Navigator.of(dialogContext).pop();
                await openAppSettings();
              },
              child: const Text('Buka pengaturan'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!_supportsWebView) {
      return _buildExternalLauncher(context);
    }

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        unawaited(_handleSystemBack());
      },
      child: AnnotatedRegion<SystemUiOverlayStyle>(
        value: SystemUiOverlayStyle.light.copyWith(
          statusBarColor: const Color(0xFF0B1220),
          statusBarIconBrightness: Brightness.light,
          statusBarBrightness: Brightness.dark,
          systemNavigationBarColor: const Color(0xFF0B1220),
          systemNavigationBarIconBrightness: Brightness.light,
        ),
        child: Scaffold(
          backgroundColor: const Color(0xFF0B1220),
          body: SafeArea(
            child: Stack(
              children: [
                Positioned.fill(child: RepaintBoundary(child: _webView)),
                ValueListenableBuilder<double>(
                  valueListenable: _progress,
                  builder: (context, value, child) {
                    if (value >= 1) return const SizedBox.shrink();
                    return LinearProgressIndicator(value: value);
                  },
                ),
                if (_errorMessage != null) _buildErrorBanner(context),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildExternalLauncher(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Buka Lajukan',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 12),
              const Text(
                'Perangkat ini belum mendukung WebView. '
                'Buka di browser untuk melanjutkan.',
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _openExternal,
                child: const Text('Buka www.lajukan.com'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildErrorBanner(BuildContext context) {
    return Align(
      alignment: Alignment.bottomCenter,
      child: Container(
        margin: const EdgeInsets.all(16),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.errorContainer,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                _errorMessage ?? 'Gagal memuat halaman.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onErrorContainer,
                ),
              ),
            ),
            const SizedBox(width: 12),
            TextButton(
              onPressed: () {
                _controller.reload();
                setState(() => _errorMessage = null);
              },
              child: const Text('Muat ulang'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReelsStudioResult {
  const _ReelsStudioResult({
    required this.path,
    required this.mediaType,
    required this.mode,
    required this.filter,
    required this.music,
    this.speed = '1x',
    this.duration = '15s',
  });

  final String path;
  final String mediaType;
  final String mode;
  final String filter;
  final String music;
  final String speed;
  final String duration;

  Map<String, String> toJson() {
    return {
      'path': path,
      'mediaType': mediaType,
      'mode': mode,
      'filter': filter,
      'music': music,
      'speed': speed,
      'duration': duration,
    };
  }
}

class _ReelsStudioScreen extends StatefulWidget {
  const _ReelsStudioScreen();

  @override
  State<_ReelsStudioScreen> createState() => _ReelsStudioScreenState();
}

class _ReelsStudioScreenState extends State<_ReelsStudioScreen>
    with WidgetsBindingObserver {
  static const _modes = ['Galeri', 'Foto', 'Video', 'Live'];
  static const _filters = ['Asli', 'Fresh', 'Warm', 'Pop', 'Cinema', 'Mono'];
  static const _durations = ['60s', '15s', '05s'];
  static const _speeds = ['0,25x', '0,5x', '1x', '1,5x', '2x'];
  static const _tracks = [
    'Original sound',
    'Beat UMKM',
    'Soft promo',
    'Live shop',
  ];

  final ImagePicker _picker = ImagePicker();
  CameraController? _controller;
  List<CameraDescription> _cameras = const [];
  int _cameraIndex = 0;
  String _mode = 'Video';
  String _filter = 'Asli';
  String _music = 'Original sound';
  String _duration = '15s';
  String _speed = '1x';
  String? _panel;
  bool _loading = true;
  bool _recording = false;
  String? _error;

  bool get _cameraReady => _controller?.value.isInitialized == true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(_prepareCamera());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller?.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!_cameraReady) return;
    if (state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused) {
      unawaited(_controller?.dispose());
    } else if (state == AppLifecycleState.resumed) {
      unawaited(_startCamera(_cameraIndex));
    }
  }

  Future<void> _prepareCamera() async {
    final permissions = await [
      Permission.camera,
      Permission.microphone,
    ].request();
    final granted = permissions.values.every(
      (status) => status.isGranted || status.isLimited,
    );
    if (!granted) {
      setState(() {
        _loading = false;
        _error = 'Izin kamera dan mikrofon diperlukan untuk Reels Studio.';
      });
      return;
    }

    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        setState(() {
          _loading = false;
          _error = 'Kamera tidak ditemukan di perangkat ini.';
        });
        return;
      }
      _cameras = cameras;
      final backIndex = cameras.indexWhere(
        (camera) => camera.lensDirection == CameraLensDirection.back,
      );
      await _startCamera(backIndex >= 0 ? backIndex : 0);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Kamera belum bisa dibuka.';
      });
    }
  }

  Future<void> _startCamera(int index) async {
    setState(() {
      _loading = true;
      _error = null;
      _cameraIndex = index;
    });

    final previous = _controller;
    _controller = null;
    await previous?.dispose();

    try {
      final controller = CameraController(
        _cameras[index],
        ResolutionPreset.high,
        enableAudio: true,
      );
      await controller.initialize();
      if (!mounted) {
        await controller.dispose();
        return;
      }
      setState(() {
        _controller = controller;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Preview kamera gagal dimuat.';
      });
    }
  }

  Future<void> _flipCamera() async {
    if (_cameras.length < 2 || _recording) return;
    final next = (_cameraIndex + 1) % _cameras.length;
    await _startCamera(next);
  }

  Future<void> _pickGallery() async {
    setState(() => _panel = null);
    final picked = await _picker.pickMedia();
    if (picked == null || !mounted) return;
    Navigator.of(context).pop(
      _ReelsStudioResult(
        path: picked.path,
        mediaType: _mediaTypeForPath(picked.path),
        mode: 'gallery',
        filter: _filter,
        music: _music,
        speed: _speed,
        duration: _duration,
      ),
    );
  }

  Future<void> _captureOrRecord() async {
    final controller = _controller;
    setState(() => _panel = null);
    if (_mode == 'Galeri') {
      await _pickGallery();
      return;
    }
    if (_mode == 'Live') {
      Navigator.of(context).pop(
        _ReelsStudioResult(
          path: '',
          mediaType: 'live',
          mode: 'live',
          filter: _filter,
          music: _music,
          speed: _speed,
          duration: _duration,
        ),
      );
      return;
    }
    if (controller == null || !_cameraReady) return;

    try {
      if (_mode == 'Foto') {
        final photo = await controller.takePicture();
        if (!mounted) return;
        Navigator.of(context).pop(
          _ReelsStudioResult(
            path: photo.path,
            mediaType: 'image',
            mode: 'photo',
            filter: _filter,
            music: _music,
            speed: _speed,
            duration: _duration,
          ),
        );
        return;
      }

      if (_recording) {
        final video = await controller.stopVideoRecording();
        if (!mounted) return;
        setState(() => _recording = false);
        Navigator.of(context).pop(
          _ReelsStudioResult(
            path: video.path,
            mediaType: 'video',
            mode: 'video',
            filter: _filter,
            music: _music,
            speed: _speed,
            duration: _duration,
          ),
        );
        return;
      }

      await controller.startVideoRecording();
      if (!mounted) return;
      setState(() => _recording = true);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Media belum bisa disimpan. Coba lagi.');
    }
  }

  String _mediaTypeForPath(String path) {
    final lower = path.toLowerCase();
    if (lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') ||
        lower.endsWith('.png') ||
        lower.endsWith('.webp') ||
        lower.endsWith('.heic')) {
      return 'image';
    }
    return 'video';
  }

  void _togglePanel(String panel) {
    setState(() => _panel = _panel == panel ? null : panel);
  }

  void _toggleBeautify() {
    setState(() {
      _filter = _filter == 'Fresh' ? 'Asli' : 'Fresh';
      _panel = null;
    });
  }

  void _cycleDuration() {
    final next = (_durations.indexOf(_duration) + 1) % _durations.length;
    setState(() => _duration = _durations[next]);
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.black,
        statusBarIconBrightness: Brightness.light,
        systemNavigationBarColor: Colors.black,
        systemNavigationBarIconBrightness: Brightness.light,
      ),
      child: Scaffold(
        backgroundColor: Colors.black,
        body: SafeArea(
          child: Stack(
            children: [
              Positioned.fill(child: _buildPreview()),
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.black.withOpacity(0.58),
                        Colors.transparent,
                        Colors.black.withOpacity(0.72),
                      ],
                      stops: const [0, 0.42, 1],
                    ),
                  ),
                ),
              ),
              Positioned(left: 12, right: 12, top: 8, child: _buildTopBar()),
              Positioned(right: 8, top: 82, child: _buildToolRail()),
              if (_panel != null)
                Positioned(
                  left: 12,
                  right: 12,
                  bottom: 222,
                  child: _buildStudioPanel(),
                ),
              Positioned(
                left: 12,
                right: 12,
                bottom: 8,
                child: _buildBottomControls(),
              ),
              if (_error != null)
                Positioned(
                  left: 16,
                  right: 16,
                  bottom: 222,
                  child: _buildError(),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPreview() {
    final controller = _controller;
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: Colors.white),
      );
    }
    if (controller == null || !_cameraReady) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.videocam_rounded, color: Colors.white, size: 54),
              const SizedBox(height: 12),
              Text(
                _error ?? 'Kamera siap dibuka',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 14),
              FilledButton(
                onPressed: _prepareCamera,
                child: const Text('Coba lagi'),
              ),
            ],
          ),
        ),
      );
    }

    return ClipRect(
      child: SizedBox.expand(
        child: FittedBox(
          fit: BoxFit.cover,
          child: SizedBox(
            width: controller.value.previewSize?.height ?? 1080,
            height: controller.value.previewSize?.width ?? 1920,
            child: CameraPreview(controller),
          ),
        ),
      ),
    );
  }

  Widget _buildTopBar() {
    return SizedBox(
      height: 48,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: _roundButton(
              icon: Icons.close_rounded,
              onTap: () => Navigator.of(context).pop(),
              label: 'Tutup',
            ),
          ),
          GestureDetector(
            onTap: () => _togglePanel('music'),
            child: Container(
              constraints: const BoxConstraints(maxWidth: 220),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.24),
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: Colors.white.withOpacity(0.10)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.music_note_rounded,
                    color: Colors.white,
                    size: 18,
                  ),
                  const SizedBox(width: 7),
                  Flexible(
                    child: Text(
                      _music == 'Original sound' ? 'SOUND' : _music,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildToolRail() {
    return Column(
      children: [
        _toolButton(
          Icons.speed_rounded,
          () => setState(() => _speed = '1x'),
          'Speed',
        ),
        const SizedBox(height: 8),
        _toolButton(Icons.flip_camera_ios_rounded, _flipCamera, 'Flip'),
        const SizedBox(height: 8),
        _toolButton(Icons.auto_awesome_rounded, _toggleBeautify, 'Beautify'),
        const SizedBox(height: 8),
        _toolButton(
          Icons.filter_vintage_rounded,
          () => _togglePanel('filters'),
          'Filters',
        ),
        const SizedBox(height: 8),
        _toolButton(Icons.timer_rounded, _cycleDuration, 'Timer'),
        const SizedBox(height: 8),
        _toolButton(Icons.help_outline_rounded, () {}, 'Q&A'),
      ],
    );
  }

  Widget _buildBottomControls() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: _durations.map((duration) {
            final active = duration == _duration;
            return GestureDetector(
              onTap: () => setState(() => _duration = duration),
              child: Container(
                width: 64,
                padding: const EdgeInsets.only(bottom: 8),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      duration,
                      style: TextStyle(
                        color: active
                            ? Colors.white
                            : Colors.white.withOpacity(0.46),
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 5),
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 140),
                      width: active ? 6 : 0,
                      height: 6,
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }).toList(),
        ),
        Container(
          height: 42,
          margin: const EdgeInsets.symmetric(horizontal: 26),
          decoration: BoxDecoration(
            color: const Color(0xFF11182B).withOpacity(0.88),
            borderRadius: BorderRadius.circular(7),
            border: Border.all(color: Colors.white.withOpacity(0.10)),
          ),
          clipBehavior: Clip.antiAlias,
          child: Row(
            children: _speeds.map((speed) {
              final active = speed == _speed;
              return Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _speed = speed),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 140),
                    alignment: Alignment.center,
                    color: active ? Colors.white : Colors.transparent,
                    child: Text(
                      speed,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: active ? Colors.black : Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            _bottomTool(
              icon: Icons.auto_awesome_rounded,
              label: 'Effects',
              onTap: () => _togglePanel('filters'),
            ),
            const Spacer(),
            GestureDetector(
              onTap: _captureOrRecord,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 160),
                width: 76,
                height: 76,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 5),
                  color: _recording
                      ? const Color(0xFFE11D48)
                      : Colors.white.withOpacity(0.18),
                ),
                child: Center(
                  child: _recording
                      ? Container(
                          width: 26,
                          height: 26,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(7),
                          ),
                        )
                      : Container(
                          width: _mode == 'Foto' ? 38 : 44,
                          height: _mode == 'Foto' ? 38 : 44,
                          decoration: BoxDecoration(
                            color: _mode == 'Live'
                                ? const Color(0xFFF43F5E)
                                : const Color(0xFFE11D48),
                            shape: BoxShape.circle,
                          ),
                          child: _mode == 'Foto'
                              ? const Icon(
                                  Icons.camera_alt_rounded,
                                  color: Colors.white,
                                  size: 21,
                                )
                              : null,
                        ),
                ),
              ),
            ),
            const Spacer(),
            _bottomTool(
              icon: Icons.image_rounded,
              label: 'Upload',
              onTap: _pickGallery,
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: _modes.map((mode) {
            final active = mode == _mode;
            return GestureDetector(
              onTap: () {
                setState(() {
                  _mode = mode;
                  _panel = null;
                });
                if (mode == 'Galeri') unawaited(_pickGallery());
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
                margin: const EdgeInsets.symmetric(horizontal: 2),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      mode,
                      style: TextStyle(
                        color: active
                            ? Colors.white
                            : Colors.white.withOpacity(0.56),
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 3),
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 140),
                      width: active ? 20 : 0,
                      height: 2,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildStudioPanel() {
    final values = _panel == 'music' ? _tracks : _filters;
    return Container(
      constraints: const BoxConstraints(maxHeight: 74),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.58),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withOpacity(0.12)),
      ),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: values.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final value = values[index];
          final active = _panel == 'music' ? value == _music : value == _filter;
          return GestureDetector(
            onTap: () {
              setState(() {
                if (_panel == 'music') {
                  _music = value;
                } else {
                  _filter = value;
                }
                _panel = null;
              });
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 140),
              constraints: const BoxConstraints(minWidth: 62),
              padding: const EdgeInsets.symmetric(horizontal: 12),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: active ? Colors.white : Colors.white.withOpacity(0.10),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(
                value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: active ? Colors.black : Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildError() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF3C7),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Text(
        _error ?? '',
        textAlign: TextAlign.center,
        style: const TextStyle(
          color: Color(0xFF78350F),
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Widget _bottomTool({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        width: 72,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.18),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.white.withOpacity(0.18)),
              ),
              child: Icon(icon, color: Colors.white, size: 23),
            ),
            const SizedBox(height: 5),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 11,
                fontWeight: FontWeight.w900,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _roundButton({
    required IconData icon,
    required VoidCallback onTap,
    required String label,
  }) {
    return Semantics(
      label: label,
      button: true,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(0.38),
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white.withOpacity(0.14)),
          ),
          child: Icon(icon, color: Colors.white, size: 22),
        ),
      ),
    );
  }

  Widget _toolButton(IconData icon, VoidCallback onTap, String label) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: Colors.black.withOpacity(0.38),
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white.withOpacity(0.14)),
            ),
            child: Icon(icon, color: Colors.white, size: 20),
          ),
          const SizedBox(height: 3),
          SizedBox(
            width: 54,
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 9,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PermissionRequestResult {
  const _PermissionRequestResult({
    required this.granted,
    required this.shouldOpenSettings,
  });

  final bool granted;
  final bool shouldOpenSettings;
}

const String _liteModeScript = '''
(function() {
  if (document.getElementById('lajukan-lite-style')) return;
  const style = document.createElement('style');
  style.id = 'lajukan-lite-style';
  style.textContent = `
    :root {
      --app-shadow: none !important;
      --app-shadow-strong: none !important;
    }
    * { scroll-behavior: auto !important; }
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
    [class*="backdrop-blur"] {
      backdrop-filter: none !important;
    }
    .ui-panel,
    .ui-panel-muted,
    .ui-panel-strong,
    .ui-hero-panel,
    .ui-contrast-panel {
      backdrop-filter: none !important;
      box-shadow: none !important;
    }
  `;
  document.head.appendChild(style);
})();
''';
