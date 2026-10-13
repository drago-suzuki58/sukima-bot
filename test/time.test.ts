import { describe, expect, it } from "vitest";
import { addDays, addMonths, jstMonthStartEpoch, jstNow, parseMonth, weekdayIndex } from "../src/time.ts";

describe("jstNow", () => {
	it("UTC 15 時は JST の翌日 0 時", () => {
		expect(jstNow(Date.UTC(2026, 10, 30, 15))).toEqual({ year: 2026, month: 12, day: 1, hour: 0 });
		expect(jstNow(Date.UTC(2026, 10, 30, 14, 59))).toEqual({ year: 2026, month: 11, day: 30, hour: 23 });
	});
});

describe("日付計算", () => {
	it("月をまたいで日を足す", () => {
		expect(addDays({ year: 2026, month: 12, day: 30 }, 3)).toEqual({ year: 2027, month: 1, day: 2 });
	});

	it("年をまたいで月を足す", () => {
		expect(addMonths({ year: 2026, month: 11 }, 2)).toEqual({ year: 2027, month: 1 });
		expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
	});

	it("曜日は月曜が 0", () => {
		expect(weekdayIndex({ year: 2026, month: 11, day: 2 })).toBe(0);
		expect(weekdayIndex({ year: 2026, month: 11, day: 1 })).toBe(6);
	});

	it("JST の月初 0 時を UNIX 秒で返す", () => {
		expect(jstMonthStartEpoch({ year: 2027, month: 1 })).toBe(Date.UTC(2026, 11, 31, 15) / 1000);
	});
});

describe("parseMonth", () => {
	it("YYYY-MM と表記ゆれを受け付ける", () => {
		expect(parseMonth("2026-11")).toEqual({ year: 2026, month: 11 });
		expect(parseMonth("2026-1")).toEqual({ year: 2026, month: 1 });
		expect(parseMonth("２０２６／０３")).toEqual({ year: 2026, month: 3 });
	});

	it("不正な値は null", () => {
		expect(parseMonth("2026-13")).toBeNull();
		expect(parseMonth("2026-00")).toBeNull();
		expect(parseMonth("11")).toBeNull();
	});
});
