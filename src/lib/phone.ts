import * as z from "zod";

// One phone representation for the whole app. Numbers arrive typed by
// humans ("+55 (11) 99999-9999"), from an automation ("5511999999999"),
// and from WhatsApp itself ("5511999999999@s.whatsapp.net"), so every
// comparison goes through normalizePhone rather than string equality.
export function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

// E.164-ish with a leading +, which is what every WhatsApp gateway expects.
export function toE164(value: string) {
  const digits = normalizePhone(value);
  return digits ? `+${digits}` : "";
}

export function samePhone(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  return normalizePhone(a) === normalizePhone(b);
}

// Google Contacts stores numbers exactly as people typed them into their
// phone, which in Brazil overwhelmingly means the local form with a DDD and
// no country code ("(11) 98888-7777"). Prefixing a bare "+" to those digits
// produces "+11988887777" — a number that reads as country code +1 and
// dials nowhere, which silently breaks every WhatsApp link built from it.
//
// So a number is only trusted as international when it says so: an explicit
// leading "+", or enough digits that a country code must already be in
// there. A 10-11 digit number is a local one and gets the default country.
const DEFAULT_COUNTRY_CODE = "55";

export function toE164FromLocal(value: string, countryCode = DEFAULT_COUNTRY_CODE) {
  const trimmed = value.trim();
  const digits = normalizePhone(trimmed);
  if (!digits) return null;

  // Already international: either written with a +, or long enough that the
  // country code cannot be missing.
  if (trimmed.startsWith("+") || digits.length >= 12) {
    return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : null;
  }

  // DDD + 8 or 9 digits — the local form.
  if (digits.length === 10 || digits.length === 11) return `+${countryCode}${digits}`;

  // Anything shorter is an extension or a fragment, and anything that lands
  // here longer than 15 is not a phone number. Both are dropped rather than
  // stored as something that looks dialable and is not.
  return null;
}

// Routed through toE164FromLocal rather than a bare "prepend +": every
// caller of this field (signup, the WhatsApp settings panel, a
// transaction's counterparty) shows the same DDD-only placeholder this
// error message promises, and a bare prepend on an 11-digit local number
// produces "+11999999999" — country code +1, not Brazil. That was this
// field's actual behavior until this rule caught it: a signup exactly as
// the form asked for it silently stored an unreachable number, and every
// inbound WhatsApp message from that number failed samePhone() against it.
const PHONE_ERROR = "Informe o WhatsApp com DDD, ex: (11) 99999-9999.";

export const phoneField = z
  .string()
  .trim()
  .refine((v) => toE164FromLocal(v) !== null, { error: PHONE_ERROR })
  .transform((v) => toE164FromLocal(v)!);

// Same rule, but an empty value is allowed and becomes null — used where
// clearing the number is a legitimate action.
export const optionalPhoneField = z
  .string()
  .trim()
  .refine((v) => v === "" || toE164FromLocal(v) !== null, { error: PHONE_ERROR })
  .transform((v) => (v === "" ? null : toE164FromLocal(v)));
