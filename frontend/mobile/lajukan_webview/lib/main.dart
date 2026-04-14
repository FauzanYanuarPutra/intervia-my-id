import 'package:flutter/foundation.dart';
import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
        message: 'Buka pengaturan perangkat untuk mengizinkan akses kamera '
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
          message:
              'Buka pengaturan perangkat untuk mengizinkan akses lokasi.',
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
              if (!result.granted &&
                  result.shouldOpenSettings &&
                  mounted) {
                await _showSettingsDialog(
                  title: 'Izin diblokir',
                  message:
                      'Buka pengaturan perangkat untuk mengizinkan akses.',
                );
              }
            }
          }
        }
      }
    } catch (_) {
      if (raw == 'openSettings') {
        await openAppSettings();
      }
    }
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
      return const _PermissionRequestResult(granted: true, shouldOpenSettings: false);
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

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
        systemNavigationBarColor: const Color(0xFF0B1220),
        systemNavigationBarIconBrightness: Brightness.light,
      ),
      child: Scaffold(
        backgroundColor: const Color(0xFF0B1220),
        body: Stack(
          children: [
            RepaintBoundary(child: _webView),
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
