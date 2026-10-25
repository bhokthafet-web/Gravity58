import { config } from "./config.js";

const parts = (date = new Date()) => Object.fromEntries(
  new Intl.DateTimeFormat("en-CA", {
    timeZone: config.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(date).map((part) => [part.type, part.value]),
);

/** "YYYY-MM-DD" in the business timezone. */
export const today = (date) => {
  const p = parts(date);
  return `${p.year}-${p.month}-${p.day}`;
};

export const localHour = (date) => Number(parts(date).hour);

export const inSendWindow = (window, date) => {
  const hour = localHour(date);
  return hour >= window.start && hour < window.end;
};
