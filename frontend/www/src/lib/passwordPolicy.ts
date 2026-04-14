const DEFAULT_MIN_LENGTH = Number.parseInt(
  process.env.AUTH_PASSWORD_MIN_LENGTH || '10',
  10,
);

function hasUppercase(password: string): boolean {
  return /[A-Z]/.test(password);
}

function hasLowercase(password: string): boolean {
  return /[a-z]/.test(password);
}

function hasNumber(password: string): boolean {
  return /[0-9]/.test(password);
}

function hasSymbol(password: string): boolean {
  return /[^A-Za-z0-9]/.test(password);
}

export function validatePasswordStrength(password: string): string | null {
  const minLength = Number.isFinite(DEFAULT_MIN_LENGTH) && DEFAULT_MIN_LENGTH > 0
    ? DEFAULT_MIN_LENGTH
    : 10;

  if (password.length < minLength) {
    return `Password must be at least ${minLength} characters`;
  }
  if (!hasUppercase(password)) {
    return 'Password must include at least one uppercase letter';
  }
  if (!hasLowercase(password)) {
    return 'Password must include at least one lowercase letter';
  }
  if (!hasNumber(password)) {
    return 'Password must include at least one number';
  }
  if (!hasSymbol(password)) {
    return 'Password must include at least one symbol';
  }
  if (/\s/.test(password)) {
    return 'Password cannot contain spaces';
  }

  return null;
}
