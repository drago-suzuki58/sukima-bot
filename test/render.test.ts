import { ComponentType, MessageFlags } from "discord-api-types/v10";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	allFreeDays,
	CELL,
	cellEmoji,
	countBusy,
	renderCalendar,
	renderFree,
	renderReminder,
	renderUserFree,
	type V2Message,
} from "../src/render.ts";

// アプリ絵文字の登録状況に依存しないよう、ID の有無をテストごとに切り替える
const emoji = vi.hoisted(() => ({ registered: true }));
vi.mock("../src/emoji.ts", () => ({
	weekdayEmoji: (i: number) => (emoji.registered ? `<:wd${i}:1>` : undefined),
	busyEmoji: (level: string, count: number) =>
		emoji.registered && count <= 99 ? `<:${level}${count}:1>` : undefined,
}));

beforeEach(() => {
	emoji.registered = true;
});

const nov = { year: 2026, month: 11 };

function countComponents(components: unknown[]): number {
	return components.reduce<number>((sum, component) => {
		const children = (component as { components?: unknown[] }).components ?? [];
		return sum + 1 + countComponents(children);
	}, 0);
}

function textContents(components: unknown[]): string[] {
	return components.flatMap((component) => {
		const { content, components: children = [] } = component as { content?: string; components?: unknown[] };
		return [...(content === undefined ? [] : [content]), ...textContents(children)];
	});
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
	it("しきい値で色分けし、人数入りの絵文字を使う", () => {
		expect(cellEmoji(0, 4, false)).toBe(CELL.free);
		expect(cellEmoji(1, 4, false)).toBe("<:few1:1>");
		expect(cellEmoji(2, 4, false)).toBe("<:many2:1>");
		expect(cellEmoji(1, 1, false)).toBe("<:many1:1>");
		expect(cellEmoji(3, 4, true)).toBe(CELL.past);
	});

	it("絵文字がなければ標準の絵文字にフォールバックする", () => {
		expect(cellEmoji(100, 250, false)).toBe(CELL.few);
		emoji.registered = false;
		expect(cellEmoji(1, 4, false)).toBe(CELL.few);
		expect(cellEmoji(3, 4, false)).toBe(CELL.many);
	});
});

describe("renderCalendar", () => {
	const today = { year: 2026, month: 11, day: 2 };
	const cell = (day: number, past: boolean) => (past ? "P" : String(day % 10));

	it("日曜始まりで週ごとに 1 行、行頭に日曜の日付を置く", () => {
		// 2026-10-01 は木曜、10-31 は土曜
		const lines = renderCalendar({ year: 2026, month: 10 }, { year: 2026, month: 10, day: 2 }, cell).split("\n");
		expect(lines[0]).toBe("`     ` <:wd0:1><:wd1:1><:wd2:1><:wd3:1><:wd4:1><:wd5:1><:wd6:1>");
		expect(lines.slice(1).map((line) => line.slice(0, 7))).toEqual([
			"`09/27`",
			"`10/04`",
			"`10/11`",
			"`10/18`",
			"`10/25`",
		]);
		expect(lines[1]).toBe(`\`09/27\` ${CELL.outside.repeat(4)}P23`);
		expect(lines[2]).toBe("`10/04` 4567890");
		expect(lines[5]).toBe("`10/25` 5678901");
	});

	it("月末の週は翌月の分を空白にする", () => {
		// 2026-11-29 は日曜
		const lines = renderCalendar(nov, today, cell).split("\n");
		expect(lines.at(-1)).toBe(`\`11/29\` 90${CELL.outside.repeat(5)}`);
	});

	it("曜日の絵文字がなければ文字で表示する", () => {
		emoji.registered = false;
		expect(renderCalendar(nov, today, cell).split("\n")[0]).toBe("`     ` 日 月 火 水 木 金 土");
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
		expect(allText(message)).toContain("<:many3:1>");
		expect(allText(message)).toContain("11/1(日), 11/2(月), 11/4(水)");
	});

	it("参加者 0 人なら登録を促す", () => {
		expect(allText(renderFree(nov, 0, new Map(), today))).toContain("まだ参加者がいません");
	});

	it("最大の行数と人数でも本文が 4000 文字に収まる", () => {
		// 2026-08 は土曜から始まる 31 日の月で、6 行になる
		const aug = { year: 2026, month: 8 };
		expect(renderCalendar(aug, { ...aug, day: 1 }, () => "x").split("\n")).toHaveLength(7);
		const counts = new Map(Array.from({ length: 31 }, (_, i) => [i + 1, 99] as [number, number]));
		const message = renderFree(aug, 100, counts, { ...aug, day: 1 });
		// 実際の絵文字は `<:skm_r99:19 桁の ID>` の長さになる
		const length = textContents(message.components).join("").replace(/<:\w+:1>/g, "<:skm_r99:1234567890123456789>").length;
		expect(length).toBeLessThan(4000);
	});
});

describe("renderUserFree", () => {
	it("その人の忙しい日を赤、空いている日を緑で表示する", () => {
		const message = renderUserFree(nov, "Alice", [3, 12, 13, 14], { year: 2026, month: 11, day: 2 });
		const text = allText(message);
		expect(text).toContain("Alice さんの予定（2026年11月）");
		expect(text).toContain(`\`11/01\` ${CELL.past}${CELL.free}${CELL.many}${CELL.free.repeat(4)}`);
		expect(text).toContain(`\`11/08\` ${CELL.free.repeat(4)}${CELL.many.repeat(3)}`);
		expect(text).toContain("忙しい日（4 日）");
		expect(text).toContain("3, 12-14");
	});

	it("表示名の Markdown 記法をエスケープする", () => {
		expect(allText(renderUserFree(nov, "**bold**", [], { year: 2026, month: 11, day: 1 }))).toContain(
			"\\\\*\\\\*bold\\\\*\\\\*",
		);
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
