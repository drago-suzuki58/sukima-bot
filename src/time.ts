// Workers の実行環境は UTC なので、UTC+9 をずらした Date の UTC 系メソッドで JST を扱う。
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"] as const;

/** month は 1-12 */
export interface YearMonth {
	year: number;
	month: number;
}

export interface JstDate extends YearMonth {
	day: number;
}

export function jstNow(now = Date.now()): JstDate & { hour: number } {
	const d = new Date(now + JST_OFFSET_MS);
	return {
		year: d.getUTCFullYear(),
		month: d.getUTCMonth() + 1,
		day: d.getUTCDate(),
		hour: d.getUTCHours(),
	};
}

export function daysInMonth(ym: YearMonth): number {
	return new Date(Date.UTC(ym.year, ym.month, 0)).getUTCDate();
}

/** 月曜を 0 とする曜日 */
export function weekdayIndex(date: JstDate): number {
	return (new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay() + 6) % 7;
}

export function addDays(date: JstDate, n: number): JstDate {
	const d = new Date(Date.UTC(date.year, date.month - 1, date.day + n));
	return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function addMonths(ym: YearMonth, n: number): YearMonth {
	const index = ym.year * 12 + (ym.month - 1) + n;
	return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function compareMonths(a: YearMonth, b: YearMonth): number {
	return a.year * 12 + a.month - (b.year * 12 + b.month);
}

export function compareDates(a: JstDate, b: JstDate): number {
	return compareMonths(a, b) || a.day - b.day;
}

/** `YYYY-MM` */
export function monthKey(ym: YearMonth): string {
	return `${ym.year}-${String(ym.month).padStart(2, "0")}`;
}

/** `YYYY-MM` 形式（全角数字と `/` 区切りも許す）を解釈する。不正なら null */
export function parseMonth(input: string): YearMonth | null {
	const match = /^(\d{4})[-/](\d{1,2})$/.exec(input.normalize("NFKC").trim());
	if (!match) return null;
	const month = Number(match[2]);
	if (month < 1 || month > 12) return null;
	return { year: Number(match[1]), month };
}

/** JST での月初 0 時の UNIX 秒 */
export function jstMonthStartEpoch(ym: YearMonth): number {
	return (Date.UTC(ym.year, ym.month - 1, 1) - JST_OFFSET_MS) / 1000;
}

/** `2026年11月` */
export function formatMonth(ym: YearMonth): string {
	return `${ym.year}年${ym.month}月`;
}

/** `11/3(火)` */
export function formatDate(date: JstDate): string {
	return `${date.month}/${date.day}(${WEEKDAYS[weekdayIndex(date)]})`;
}
