// アプリ絵文字の参照。scripts/emoji.ts で生成・登録し、ID を emoji.json に書き出す。
// 未登録の絵文字は undefined を返すので、呼び出し側は標準の絵文字にフォールバックする。
import ids from "./emoji.json" with { type: "json" };

/** 人数入りの絵文字を用意する上限。これを超える人数は数字なしのマスで表示する */
export const MAX_BUSY_EMOJI = 99;

export type BusyLevel = "few" | "many";

/** 日曜が 0 */
export const weekdayEmojiName = (index: number) => `skm_wd${index}`;
export const busyEmojiName = (level: BusyLevel, count: number) => `skm_${level === "few" ? "y" : "r"}${count}`;

function custom(name: string): string | undefined {
	const id = (ids as Record<string, string>)[name];
	return id && `<:${name}:${id}>`;
}

export function weekdayEmoji(index: number): string | undefined {
	return custom(weekdayEmojiName(index));
}

export function busyEmoji(level: BusyLevel, count: number): string | undefined {
	return count >= 1 && count <= MAX_BUSY_EMOJI ? custom(busyEmojiName(level, count)) : undefined;
}
