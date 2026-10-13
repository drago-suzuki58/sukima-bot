import { daysInMonth } from "./time.ts";

const RANGE_SEPARATOR = "[-~〜ー]";

/**
 * 「3, 5, 12-14」形式の入力を、その月の日付の配列に変換する。
 * 解釈できないトークンや範囲外の値は invalid に入れてスキップする。
 */
export function parseDays(
	input: string,
	year: number,
	month: number,
): { days: number[]; invalid: string[] } {
	const lastDay = daysInMonth({ year, month });
	const days = new Set<number>();
	const invalid: string[] = [];

	// NFKC で全角数字・全角カンマ・全角空白・全角ハイフンなどを半角に寄せる
	const normalized = input
		.normalize("NFKC")
		.replace(new RegExp(`\\s*(${RANGE_SEPARATOR})\\s*`, "g"), "$1");
	const tokens = normalized.split(/[,、\s]+/).filter((token) => token !== "");

	for (const token of tokens) {
		const match = new RegExp(`^(\\d+)(?:${RANGE_SEPARATOR}(\\d+))?$`).exec(token);
		const start = match ? Number(match[1]) : Number.NaN;
		const end = match?.[2] === undefined ? start : Number(match[2]);
		if (!(start >= 1 && start <= end && end <= lastDay)) {
			invalid.push(token);
			continue;
		}
		for (let day = start; day <= end; day++) days.add(day);
	}

	return { days: [...days].sort((a, b) => a - b), invalid };
}

/** 昇順の日付配列を `3, 5, 12-14` の形にまとめる。parseDays で読み戻せる */
export function formatDays(days: number[]): string {
	const parts: string[] = [];
	for (let i = 0; i < days.length; i++) {
		const start = days[i];
		while (days[i + 1] === days[i] + 1) i++;
		const end = days[i];
		parts.push(end - start >= 2 ? `${start}-${end}` : start === end ? `${start}` : `${start}, ${end}`);
	}
	return parts.join(", ");
}
