export const NIGERIA_DIAL_CODE = "234";
export const OTP_CODE_LENGTH = 6;

const PASSWORD_REQUIREMENTS = [
  {
    pattern: /^.{8,}$/,
    message: "Password must be at least 8 characters long.",
  },
  {
    pattern: /^.{0,64}$/,
    message: "Password must be 64 characters or fewer.",
  },
  {
    pattern: /[A-Z]/,
    message: "Please add an uppercase letter.",
  },
  {
    pattern: /[a-z]/,
    message: "Please add a lowercase letter.",
  },
  {
    pattern: /\d/,
    message: "Please add a number.",
  },
  {
    pattern: /[^A-Za-z0-9]/,
    message: "Please add a special character.",
  },
] as const;

export function normalizeLocalPhoneNumber(phoneNumber: string): string {
  const digitsOnly = phoneNumber.replace(/\D/g, "");
  const withoutCountryCode = digitsOnly.startsWith(NIGERIA_DIAL_CODE)
    ? digitsOnly.slice(NIGERIA_DIAL_CODE.length)
    : digitsOnly;

  return withoutCountryCode.replace(/^0+/, "");
}

export function buildInternationalPhoneNumber(phoneNumber: string): string {
  return `${NIGERIA_DIAL_CODE}${normalizeLocalPhoneNumber(phoneNumber)}`;
}

export function isValidLocalPhoneNumber(phoneNumber: string): boolean {
  return /^\d{10}$/.test(normalizeLocalPhoneNumber(phoneNumber));
}

export function validatePassword(password: string): string[] {
  return PASSWORD_REQUIREMENTS.filter(({ pattern }) => !pattern.test(password)).map(
    ({ message }) => message,
  );
}
