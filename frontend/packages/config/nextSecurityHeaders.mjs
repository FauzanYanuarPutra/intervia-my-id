const PUBLIC_SCRIPT_SOURCES = [
  'https://accounts.google.com',
  'https://apis.google.com',
  'https://static.cloudflareinsights.com',
];

const PUBLIC_CONNECT_SOURCES = [
  'https://oauth2.googleapis.com',
  'https://www.googleapis.com',
  'https://accounts.google.com',
  'https:',
  'wss:',
  'ws:',
  'stun:',
  'turn:',
  'turns:',
  'http://auth.localhost',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'ws://localhost:3000',
  'ws://127.0.0.1:3000',
  'ws://localhost:4000',
  'ws://127.0.0.1:4000',
  'https://lajukan.com',
  'https://auth.lajukan.com',
  'wss://lajukan.com',
  'wss://www.lajukan.com',
  'wss://chat.lajukan.com',
];

function directive(name, values) {
  return `${name} ${values.join(' ')}`;
}

export function buildContentSecurityPolicy({
  production = false,
  scriptSources = [],
  connectSources = [],
  frameSources = [],
  styleSources = [],
  fontSources = [],
  imageSources = ["'self'", 'data:', 'blob:'],
  mediaSources = ["'self'", 'data:', 'blob:'],
} = {}) {
  const directives = [
    directive('default-src', ["'self'"]),
    directive('base-uri', ["'self'"]),
    directive('frame-ancestors', ["'none'"]),
    directive('object-src', ["'none'"]),
    directive('form-action', ["'self'"]),
    directive('manifest-src', ["'self'"]),
    directive('style-src', ["'self'", "'unsafe-inline'", ...styleSources]),
    directive('font-src', ["'self'", 'data:', ...fontSources]),
    directive('img-src', imageSources),
    directive('media-src', mediaSources),
    directive('worker-src', ["'self'", 'blob:']),
    directive('script-src', [
      "'self'",
      "'unsafe-inline'",
      ...(production ? [] : ["'unsafe-eval'"]),
      'blob:',
      ...scriptSources,
    ]),
    directive('connect-src', ["'self'", ...connectSources]),
    directive(
      'frame-src',
      frameSources.length > 0 ? frameSources : ["'none'"],
    ),
    directive(
      'child-src',
      frameSources.length > 0 ? frameSources : ["'none'"],
    ),
  ];

  if (production) directives.push('upgrade-insecure-requests');
  return `${directives.join('; ')};`;
}

export function buildPublicWebCsp({ production = false } = {}) {
  return buildContentSecurityPolicy({
    production,
    scriptSources: PUBLIC_SCRIPT_SOURCES,
    connectSources: PUBLIC_CONNECT_SOURCES,
    frameSources: ['https://accounts.google.com'],
    styleSources: ['https://fonts.googleapis.com'],
    fontSources: ['https://fonts.gstatic.com'],
    imageSources: ["'self'", 'data:', 'blob:', 'https:'],
    mediaSources: ["'self'", 'data:', 'blob:', 'https:'],
  });
}

export function buildInternalWebCsp({
  production = false,
  connectSources = [],
} = {}) {
  return buildContentSecurityPolicy({
    production,
    connectSources,
    imageSources: ["'self'", 'data:', 'blob:', 'https:'],
    mediaSources: ["'self'", 'data:', 'blob:', 'https:'],
  });
}

export function buildSecurityHeaders({
  csp,
  production = false,
  permissionsPolicy =
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  crossOriginOpenerPolicy = 'same-origin',
  robotsTag,
} = {}) {
  const headers = [
    { key: 'Content-Security-Policy', value: csp },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-DNS-Prefetch-Control', value: 'on' },
    { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
    { key: 'X-XSS-Protection', value: '0' },
    { key: 'Origin-Agent-Cluster', value: '?1' },
    { key: 'Cross-Origin-Opener-Policy', value: crossOriginOpenerPolicy },
    { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: permissionsPolicy },
  ];

  if (robotsTag) headers.push({ key: 'X-Robots-Tag', value: robotsTag });
  if (production) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload',
    });
  }

  return headers;
}
