import { ComponentType, MessageFlags } from "discord-api-types/v10";
import { describe, expect, it } from "vitest";
import {
	allFreeDays,
	CELL,
	cellEmoji,
	countBusy,
	renderCalendar,
	renderFree,
	renderReminder,
	type V2Message,
} from "../src/render.ts";

const nov = { year: 2026, month: 11 };

function countComponents(components: unknown[]): number {
	return components.reduce<number>((sum, component) => {
		const children = (component as { components?: unknown[] }).components ?? [];
		return sum + 1 + countComponents(children);
	}, 0);
}

function allText(message: V2Message): string {
	return JSON.stringify(message);
}

describe("countBusy", () => {
	it("参加者の登録だけを日ごとに数える", () => {
		const entries = new Map([
			["a", [1, 2]],
			["b", [2]],
			["left", [1, 2, 3]],
		]);
		expect(countBusy(entries, new Set(["a", "b"]))).toEqual(
			new Map([
				[1, 1],
				[2, 2],
			]),
		);
	});
});

describe("cellEmoji", () => {
	it("しきい値で色分けする", () => {
		expect(cellEmoji(0, 4, false)).toBe(CELL.free);
		expect(cellEmoji(1, 4, false)).toBe(CELL.few);
		expect(cellEmoji(2, 4, false)).toBe(CELL.many);
		expect(cellEmoji(1, 1, false)).toBe(CELL.many);
		expect(cellEmoji(0, 4, true)).toBe(CELL.past);
	});
});

describe("renderCalendar", () => {
	it("月曜始まりで週ごとに 1 行、行頭に月曜の日付を置く", () => {
		// 2026-11-01 は日曜、11-30 は月曜
		const lines = renderCalendar(nov, 2, new Map([[3, 1]]), { year: 2026, month: 11, day: 2 }).split("\n");
		expect(lines[0]).toBe("`     ` 月 火 水 木 金 土 日");
		expect(lines.slice(1).map((line) => line.slice(0, 7))).toEqual([
			"`10/26`",
			"`11/02`",
			"`11/09`",
			"`11/16`",
			"`11/23`",
			"`11/30`",
		]);
		expect(lines[1]).toBe(`\`10/26\` ${CELL.outside.repeat(6)}${CELL.past}`);
		expect(lines[2]).toBe(`\`11/02\` ${CELL.free}${CELL.many}${CELL.free.repeat(5)}`);
		expect(lines[6]).toBe(`\`11/30\` ${CELL.free}${CELL.outside.repeat(6)}`);
	});
});

describe("allFreeDays", () => {
	it("今日以降で忙しい人が 0 人の日を返す", () => {
		const counts = new Map([[4, 1]]);
		const days = allFreeDays(nov, counts, { year: 2026, month: 11, day: 3 }).map((d) => d.day);
		expect(days[0]).toBe(3);
		expect(days).not.toContain(4);
		expect(days).not.toContain(2);
		expect(days.length).toBe(27);
	});
});

describe("renderFree", () => {
	const today = { year: 2026, month: 11, day: 1 };

	it("Components V2 の公開メッセージで、上限 40 個以内に収まる", () => {
		const message = renderFree(nov, 3, new Map([[3, 3]]), today);
		expect(message.flags).toBe(MessageFlags.IsComponentsV2);
		expect(message.components[0].type).toBe(ComponentType.Container);
		expect(countComponents(message.components)).toBeLessThanOrEqual(40);
		expect(allText(message)).toContain("2026年11月の空き状況");
		expect(allText(message)).toContain("参加者 3 人");
		expect(allText(message)).toContain("11/1(日), 11/2(月), 11/4(水)");
	});

	it("参加者 0 人なら登録を促す", () => {
		expect(allText(renderFree(nov, 0, new Map(), today))).toContain("まだ参加者がいません");
	});
});

describe("renderReminder", () => {
	it("今日の状況と全員が空いている日を表示する", () => {
		const today = { year: 2026, month: 11, day: 3 };
		const text = allText(renderReminder(today, 3, 1, [{ year: 2026, month: 11, day: 5 }]));
		expect(text).toContain("11/3(火) の空き状況");
		expect(text).toContain("今日忙しい人: 1 / 3 人");
		expect(text).toContain("11/5(木)");
		expect(text).toContain("/skm busy");
	});

	it("全員が空いている日がなければ「なし」", () => {
		const text = allText(renderReminder({ year: 2026, month: 11, day: 3 }, 2, 0, []));
		expect(text).toContain("全員が空いている日**\\nなし");
	});
});
