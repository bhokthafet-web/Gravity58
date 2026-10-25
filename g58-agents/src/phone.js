// Normalise Indian phone numbers to E.164 without the plus sign ("91XXXXXXXXXX"),
// which is the format the WhatsApp Cloud API uses for wa_id.
export function normalizeIndianPhone(raw) {
  if (!raw) return null;
  const first = String(raw).split(/[;,/]/)[0];
  let digits = first.replace(/\D/g, "");
  if (digits.startsWith("0091")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  // Only Indian mobiles (start 6-9) can receive WhatsApp; landlines are useless here.
  if (!/^91[6-9]\d{9}$/.test(digits)) return null;
  return digits;
}

const STOP_WORDS = /^\s*(stop|unsubscribe|cancel|remove|no thanks|not interested|don'?t message|do not message|block)\b/i;

export const isOptOut = (text) => STOP_WORDS.test(String(text || ""));
