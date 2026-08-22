type AuthEnvironment = Record<string, string | undefined>;

function parseBoolean(value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return undefined;
}

function isRouteOtpRequired(
  routeKey: 'LOGIN_OTP_REQUIRED' | 'REGISTER_OTP_REQUIRED',
  environment: AuthEnvironment,
): boolean {
  const otpInfrastructureEnabled =
    parseBoolean(environment.ENABLE_OTP_AUTH) ?? true;
  if (!otpInfrastructureEnabled) return false;

  return parseBoolean(environment[routeKey]) ?? true;
}

export function isLoginOtpRequired(
  environment: AuthEnvironment = process.env,
): boolean {
  return isRouteOtpRequired('LOGIN_OTP_REQUIRED', environment);
}

export function isRegisterOtpRequired(
  environment: AuthEnvironment = process.env,
): boolean {
  return isRouteOtpRequired('REGISTER_OTP_REQUIRED', environment);
}

export function isExternalHttpsRequired(
  environment: AuthEnvironment = process.env,
): boolean {
  const deploymentEnvironment = (
    environment.APP_ENV ||
    environment.ENV ||
    ''
  )
    .trim()
    .toLowerCase();

  if (deploymentEnvironment) {
    return deploymentEnvironment !== 'development';
  }
  return environment.NODE_ENV === 'production';
}
