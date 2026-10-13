import type { APIApplicationCommandOptionChoice } from "discord-api-types/v10";
import { addMonths, formatMonth, type JstDate, monthKey, parseMonth, type YearMonth } from "../time.ts";

export const INVALID_MONTH = "月は `YYYY-MM` の形式で指定してください（例: 2026-11）";

const CHOICE_MONTHS = 4;

/** month オプションを解釈する。省略時は今月、不正なら null */
export function resolveMonth(value: string | number | boolean | undefined, now: JstDate): YearMonth | null {
	if (value === undefined) return { year: now.year, month: now.month };
	return typeof value === "string" ? parseMonth(value) : null;
}

/** 今月から 3 か月先までの候補。入力に一致するものがなければすべて返す */
export function monthChoices(focused: string, now: JstDate): APIApplicationCommandOptionChoice<string>[] {
	const choices = Array.from({ length: CHOICE_MONTHS }, (_, i) => {
		const ym = addMonths(now, i);
		return { name: formatMonth(ym), value: monthKey(ym) };
	});
	const query = focused.normalize("NFKC").trim();
	const matched = choices.filter((choice) => choice.name.includes(query) || choice.value.includes(query));
	return matched.length > 0 ? matched : choices;
}
