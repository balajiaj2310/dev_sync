/**
 * DevSync Form Validators
 */

export function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

export function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

export function isValidRepoName(name) {
  const re = /^[a-zA-Z0-9_.-]+$/;
  return typeof name === 'string' && name.length >= 2 && re.test(name);
}

export function isValidRequired(val) {
  return val !== null && val !== undefined && String(val).trim().length > 0;
}
