import { DAY_DEFS } from "../config.js?v=1.1.0";

const DAY_MS = 86400000;

export function dateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromDateKey(key) {
  const [year, month, day] = String(key).split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function addDays(value, amount) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
}

export function startOfWeek(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setHours(12, 0, 0, 0);
  const weekday = date.getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  date.setDate(date.getDate() + offset);
  return date;
}

export function weekKey(value = new Date()) {
  return dateKey(startOfWeek(value));
}

export function routeDayForDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const weekday = date.getDay();
  if (weekday >= 1 && weekday <= 5) return DAY_DEFS[weekday - 1].id;
  return "mon";
}

export function dateForRouteDay(dayId, week = weekKey()) {
  const definition = DAY_DEFS.find((day) => day.id === dayId) || DAY_DEFS[0];
  return addDays(fromDateKey(week), definition.index - 1);
}

export function dayDefinition(dayId) {
  return DAY_DEFS.find((day) => day.id === dayId) || DAY_DEFS[0];
}

export function daysBetween(a, b) {
  const left = fromDateKey(dateKey(a)).getTime();
  const right = fromDateKey(dateKey(b)).getTime();
  return Math.round((right - left) / DAY_MS);
}

export function isOverdue(key, today = dateKey()) {
  return Boolean(key) && key < today;
}

export function formatShortDate(value) {
  if (!value) return "No date";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? fromDateKey(value) : new Date(value);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

export function formatLongDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(date);
}

export function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function monthGrid(value = new Date()) {
  const anchor = value instanceof Date ? new Date(value) : new Date(value);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1, 12);
  const startOffset = first.getDay();
  const lastDay = new Date(year, month + 1, 0, 12).getDate();
  const cells = Array.from({ length: startOffset }, () => null);
  for (let day = 1; day <= lastDay; day += 1) {
    cells.push(new Date(year, month, day, 12));
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}
