export type ContentSecurityPolicyOptions = {
  production?: boolean;
  scriptSources?: string[];
  connectSources?: string[];
  frameSources?: string[];
  styleSources?: string[];
  fontSources?: string[];
  imageSources?: string[];
  mediaSources?: string[];
};

export type SecurityHeaderOptions = {
  csp: string;
  production?: boolean;
  permissionsPolicy?: string;
  crossOriginOpenerPolicy?: string;
  robotsTag?: string;
};

export function buildContentSecurityPolicy(
  options?: ContentSecurityPolicyOptions,
): string;
export function buildPublicWebCsp(options?: { production?: boolean }): string;
export function buildInternalWebCsp(options?: {
  production?: boolean;
  connectSources?: string[];
}): string;
export function buildSecurityHeaders(
  options: SecurityHeaderOptions,
): Array<{ key: string; value: string }>;
