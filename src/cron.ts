import { env } from "cloudflare:workers";
import { countBusy, renderReminder, type V2Message } from "./render.ts";
import { getConfig, listBusy, listGuildsToRemind, listMembers, putConfig } from "./store.ts";
import { addDays, compareMonths, type JstDate, jstNow, type YearMonth } from "./time.ts";

/** 403/404 がこの回数続いたらリマインドを停止する */
const MAX_FAILURES = 3;
const LOOKAHEAD_DAYS = 7;

/** 設定時刻（JST）が現在の時と一致するサーバーにリマインドを送る */
export async function runReminders(scheduledTime: number): Promise<void> {
	const now = jstNow(scheduledTime);
	for (const guildId of await listGuildsToRemind(now.hour)) {
		try {
			await remind(guildId, now);
		} catch (error) {
			console.error(`リマインドに失敗しました guild=${guildId}`, error);
		}
	}
}

async function remind(guildId: string, today: JstDate): Promise<void> {
	// KV の結果整合で metadata が古い場合に備え、本体の設定も確かめる
	const config = await getConfig(guildId);
	if (!config?.enabled) return;

	const dates = Array.from({ length: LOOKAHEAD_DAYS + 1 }, (_, i) => addDays(today, i));
	const months = dates.reduce<YearMonth[]>((acc, date) => {
		const last = acc.at(-1);
		if (!last || compareMonths(last, date) !== 0) acc.push({ year: date.year, month: date.month });
		return acc;
	}, []);
	const members = await listMembers(guildId);
	const countsByMonth = await Promise.all(
		months.map(async (ym) => countBusy(await listBusy(guildId, ym), members)),
	);
	const busyOn = (date: JstDate) =>
		countsByMonth[months.findIndex((ym) => compareMonths(ym, date) === 0)].get(date.day) ?? 0;

	const freeDates = dates.slice(1).filter((date) => busyOn(date) === 0);
	const status = await postMessage(config.channelId, renderReminder(today, members.size, busyOn(today), freeDates));

	if (status === 403 || status === 404) {
		const failures = config.failures + 1;
		const enabled = failures < MAX_FAILURES;
		console.error(`リマインドを送信できません guild=${guildId} status=${status} failures=${failures} enabled=${enabled}`);
		await putConfig(guildId, { ...config, failures, enabled });
	} else if (status >= 200 && status < 300) {
		if (config.failures > 0) await putConfig(guildId, { ...config, failures: 0 });
	} else {
		console.error(`リマインドの送信に失敗しました guild=${guildId} status=${status}`);
	}
}

async function postMessage(channelId: string, message: V2Message): Promise<number> {
	const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
		method: "POST",
		headers: {
			Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(message),
	});
	if (!response.ok) console.error(`Discord API ${response.status}: ${await response.text()}`);
	return response.status;
}
