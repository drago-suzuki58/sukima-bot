import { describe, expect, it } from "vitest";
import { formatDays, parseDays } from "../src/parse.ts";

describe("parseDays", () => {
	it("カンマ・読点・全角カンマ・空白で区切る", () => {
		expect(parseDays("3, 5、7，9  11\n13", 2026, 11)).toEqual({ days: [3, 5, 7, 9, 11, 13], invalid: [] });
	});

	it("連続した区切り文字を許す", () => {
		expect(parseDays(",,3,,, 、5 ", 2026, 11)).toEqual({ days: [3, 5], invalid: [] });
	});

	it("範囲指定の区切りを複数受け付ける", () => {
		expect(parseDays("1-2, 4~5, 7〜8, 10ー11, 13 - 14", 2026, 11).days).toEqual([
			1, 2, 4, 5, 7, 8, 10, 11, 13, 14,
		]);
	});

	it("全角数字・全角記号を半角に正規化する", () => {
		expect(parseDays("３，１２－１４　２０～２１", 2026, 11).days).toEqual([3, 12, 13, 14, 20, 21]);
	});

	it("重複を除いて昇順に並べる", () => {
		expect(parseDays("20, 3, 5, 3, 4-6", 2026, 11).days).toEqual([3, 4, 5, 6, 20]);
	});

	it("空入力は空配列", () => {
		expect(parseDays("", 2026, 11)).toEqual({ days: [], invalid: [] });
		expect(parseDays("  、 ", 2026, 11)).toEqual({ days: [], invalid: [] });
	});

	it("範囲外・解釈できないトークンはスキップして通知する", () => {
		expect(parseDays("0, 3, 31, abc, 5-, 10-8, 28-31, 4日", 2026, 11)).toEqual({
			days: [3],
			invalid: ["0", "31", "abc", "5-", "10-8", "28-31", "4日"],
		});
	});

	it("うるう年の 2 月を考慮する", () => {
		expect(parseDays("28, 29", 2028, 2)).toEqual({ days: [28, 29], invalid: [] });
		expect(parseDays("28, 29", 2026, 2)).toEqual({ days: [28], invalid: ["29"] });
		expect(parseDays("29", 2100, 2).invalid).toEqual(["29"]);
		expect(parseDays("29", 2000, 2).days).toEqual([29]);
	});
});

describe("formatDays", () => {
	it("3 日以上の連続を範囲にまとめる", () => {
		expect(formatDays([3, 5, 6, 12, 13, 14, 30])).toBe("3, 5, 6, 12-14, 30");
	});

	it("空配列は空文字", () => {
		expect(formatDays([])).toBe("");
	});

	it("parseDays で読み戻せる", () => {
		const days = [1, 2, 3, 7, 9, 10, 20, 21, 22, 23, 31];
		expect(parseDays(formatDays(days), 2026, 12).days).toEqual(days);
	});
});
