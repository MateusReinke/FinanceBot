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

// 10-15 digits covers every country code; Brazilian mobiles are 13 with
// the +55 and the 9. Deliberately not stricter than that — rejecting a
// valid foreign number at signup would be worse than accepting a typo the
// user can fix in Configurações.
export const phoneField = z
  .string()
  .trim()
  .transform((v) => normalizePhone(v))
  .refine((v) => /^\d{10,15}$/.test(v), {
    error: "Informe o WhatsApp com DDD, ex: (11) 99999-9999.",
  })
  .transform((v) => `+${v}`);

// Same rules, but an empty value is allowed and becomes null — used where
// clearing the number is a legitimate action.
export const optionalPhoneField = z
  .string()
  .trim()
  .transform((v) => normalizePhone(v))
  .refine((v) => v === "" || /^\d{10,15}$/.test(v), {
    error: "Informe o WhatsApp com DDD, ex: (11) 99999-9999.",
  })
  .transform((v) => (v ? `+${v}` : null));
