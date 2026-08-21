export const PASSWORD_REQUIREMENTS = 'Use at least 8 characters with uppercase, lowercase, number, and special character.';

export const isStandardPassword = (password: string) =>
  password.length >= 8 &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password) &&
  /\d/.test(password) &&
  /[^A-Za-z0-9]/.test(password);