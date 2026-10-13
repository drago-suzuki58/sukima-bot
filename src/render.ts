import {
	type APIAllowedMentions,
	type APIComponentInContainer,
	type APIMessageTopLevelComponent,
	type APITextDisplayComponent,
	ComponentType,
	MessageFlags,
} from "discord-api-types/v10";
import { busyEmoji, weekdayEmoji } from "./emoji.ts";
import { formatDays } from "./parse.ts";
import {
	addDays,
	compareDates,
	daysInMonth,
	formatDate,
	formatMonth,
	type JstDate,
	WEEKDAYS,
	weekdayIndex,
	type YearMonth,
} from "./time.ts";

export interface V2Message {
	flags: MessageFlags;
	components: APIMessageTopLevelComponent[];
	allowed_mentions: APIAllowedMentions;
}

export const CELL = {
	free: "🟩",
	few: "🟨",
	many: "🟥",
	past: "⬛",
	outside: "▫️",
} as const;

const LEGEND = `-# ${CELL.free} 全員空き　${CELL.few} 半数未満が忙しい　${CELL.many} 半数以上が忙しい　${CELL.past} 過去　数字は忙しい人数`;
const USER_LEGEND = `-# ${CELL.free} 空き　${CELL.many} 忙しい　${CELL.past} 過去`;
const REGISTER_HINT = "`/skm busy` で忙しい日を登録できます";

function message(components: APIMessageTopLevelComponent[], ephemeral: boolean): V2Message {
	return {
		flags: MessageFlags.IsComponentsV2 | (ephemeral ? MessageFlags.Ephemeral : 0),
		components,
		allowed_mentions: { parse: [] },
	};
}

function container(children: APIComponentInContainer[]): APIMessageTopLevelComponent {
	return { type: ComponentType.Container, components: children };
}

function text(content: string): APITextDisplayComponent {
	return { type: ComponentType.TextDisplay, content };
}

const separator: APIComponentInContainer = { type: ComponentType.Separator };

/** 単純な通知メッセージ。既定で ephemeral */
export function textMessage(content: string, ephemeral = true): V2Message {
	return message([text(content)], ephemeral);
}

/** 参加者の登録から日ごとの忙しい人数を数える。参加者以外の登録は数えない */
export function countBusy(entries: Map<string, number[]>, members: Set<string>): Map<number, number> {
	const counts = new Map<number, number>();
	for (const [user, days] of entries) {
		if (!members.has(user)) continue;
		for (const day of days) counts.set(day, (counts.get(day) ?? 0) + 1);
	}
	return counts;
}

/** 忙しい人数で色分けし、アプリ絵文字があれば人数入りのマスにする */
export function cellEmoji(busy: number, participants: number, past: boolean): string {
	if (past) return CELL.past;
	if (busy === 0) return CELL.free;
	const level = busy * 2 < participants ? "few" : "many";
	return busyEmoji(level, busy) ?? CELL[level];
}

/** 曜日ヘッダー。アプリ絵文字が揃っていなければ文字で表示する */
function weekdayHeader(): string {
	const emojis = WEEKDAYS.map((_, i) => weekdayEmoji(i));
	return emojis.every((emoji) => emoji !== undefined) ? emojis.join("") : WEEKDAYS.join(" ");
}

/** 日曜始まりで 1 行 7 マス。行頭にその週の日曜の日付を置く。マスの中身は cell で決める */
export function renderCalendar(
	ym: YearMonth,
	today: JstDate,
	cell: (day: number, past: boolean) => string,
): string {
	const first: JstDate = { ...ym, day: 1 };
	const last: JstDate = { ...ym, day: daysInMonth(ym) };
	const lines = [`\`     \` ${weekdayHeader()}`];

	for (let sunday = addDays(first, -weekdayIndex(first)); compareDates(sunday, last) <= 0; sunday = addDays(sunday, 7)) {
		const label = `${String(sunday.month).padStart(2, "0")}/${String(sunday.day).padStart(2, "0")}`;
		let cells = "";
		for (let i = 0; i < 7; i++) {
			const date = addDays(sunday, i);
			cells += date.month === ym.month ? cell(date.day, compareDates(date, today) < 0) : CELL.outside;
		}
		lines.push(`\`${label}\` ${cells}`);
	}
	return lines.join("\n");
}

/** 今日以降で、忙しい人が 0 人の日 */
export function allFreeDays(ym: YearMonth, counts: Map<number, number>, today: JstDate): JstDate[] {
	const days: JstDate[] = [];
	for (let day = 1; day <= daysInMonth(ym); day++) {
		const date = { ...ym, day };
		if (compareDates(date, today) >= 0 && !counts.get(day)) days.push(date);
	}
	return days;
}

function formatDateList(dates: JstDate[]): string {
	return dates.length > 0 ? dates.map(formatDate).join(", ") : "なし";
}

export function renderFree(
	ym: YearMonth,
	participants: number,
	counts: Map<number, number>,
	today: JstDate,
): V2Message {
	const summary =
		participants > 0
			? `**全員空いている日**\n${formatDateList(allFreeDays(ym, counts, today))}`
			: `まだ参加者がいません。${REGISTER_HINT}`;
	return message(
		[
			container([
				text(`## ${formatMonth(ym)}の空き状況\n参加者 ${participants} 人`),
				text(renderCalendar(ym, today, (day, past) => cellEmoji(counts.get(day) ?? 0, participants, past))),
				separator,
				text(summary),
				text(LEGEND),
			]),
		],
		false,
	);
}

function escapeMarkdown(value: string): string {
	return value.replace(/([\\*_~`|>#[\]])/g, "\\$1");
}

/** 1 人分の予定。忙しい日を赤、空いている日を緑で表示する */
export function renderUserFree(ym: YearMonth, name: string, days: number[], today: JstDate): V2Message {
	const busy = new Set(days);
	const summary = days.length > 0 ? `**忙しい日（${days.length} 日）**\n${formatDays(days)}` : "この月の登録はありません";
	return message(
		[
			container([
				text(`## ${escapeMarkdown(name)} さんの予定（${formatMonth(ym)}）`),
				text(renderCalendar(ym, today, (day, past) => (past ? CELL.past : busy.has(day) ? CELL.many : CELL.free))),
				separator,
				text(summary),
				text(USER_LEGEND),
			]),
		],
		false,
	);
}

export function renderReminder(
	today: JstDate,
	participants: number,
	todayBusy: number,
	freeDates: JstDate[],
): V2Message {
	const body =
		participants > 0
			? [
					text(`## ${formatDate(today)} の空き状況\n今日忙しい人: ${todayBusy} / ${participants} 人`),
					separator,
					text(`**明日から 7 日間で全員が空いている日**\n${formatDateList(freeDates)}`),
					text(`-# ${REGISTER_HINT}`),
				]
			: [text(`## ${formatDate(today)} の空き状況\nまだ参加者がいません。${REGISTER_HINT}`)];
	return message([container(body)], false);
}
