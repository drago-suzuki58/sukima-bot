// KV へのアクセスはこのモジュールに閉じ込める。
// キーはユーザー×月単位に分け、各ユーザーが自分のキーだけを書くことで同時更新の衝突を避ける。
import { env } from "cloudflare:workers";
import { addMonths, jstMonthStartEpoch, monthKey, type YearMonth } from "./time.ts";

export interface ReminderConfig {
	channelId: string;
	/** JST の時 (0-23) */
	hour: number;
	enabled: boolean;
	/** 403/404 で連続して送信に失敗した回数 */
	failures: number;
}

interface BusyMetadata {
	d: string;
}

interface MemberMetadata {
	name: string;
}

interface ConfigMetadata {
	hour: number;
	enabled: boolean;
}

const busyPrefix = (guild: string, ym: YearMonth) => `busy:${guild}:${monthKey(ym)}:`;
const memberPrefix = (guild: string) => `member:${guild}:`;
const configKey = (guild: string) => `cfg:${guild}`;

function decodeDays(value: string | null | undefined): number[] {
	return value ? value.split(",").map(Number) : [];
}

async function listAll<M>(prefix: string): Promise<KVNamespaceListKey<M>[]> {
	const keys: KVNamespaceListKey<M>[] = [];
	let cursor: string | undefined;
	do {
		const page = await env.SKM_KV.list<M>({ prefix, cursor });
		keys.push(...page.keys);
		cursor = page.list_complete ? undefined : page.cursor;
	} while (cursor);
	return keys;
}

export async function getBusy(guild: string, ym: YearMonth, user: string): Promise<number[]> {
	return decodeDays(await env.SKM_KV.get(busyPrefix(guild, ym) + user));
}

/** その月の登録を丸ごと置き換える。空配列なら削除する */
export async function putBusy(guild: string, ym: YearMonth, user: string, days: number[]): Promise<void> {
	const key = busyPrefix(guild, ym) + user;
	if (days.length === 0) {
		await env.SKM_KV.delete(key);
		return;
	}
	const value = days.join(",");
	await env.SKM_KV.put(key, value, {
		metadata: { d: value } satisfies BusyMetadata,
		// 対象月の 2 か月後の月初に自動削除する
		expiration: jstMonthStartEpoch(addMonths(ym, 2)),
	});
}

/** ユーザー ID → 忙しい日。日付は metadata から読むので get を人数分呼ばない */
export async function listBusy(guild: string, ym: YearMonth): Promise<Map<string, number[]>> {
	const prefix = busyPrefix(guild, ym);
	const keys = await listAll<BusyMetadata>(prefix);
	return new Map(keys.map((key) => [key.name.slice(prefix.length), decodeDays(key.metadata?.d)]));
}

export async function putMember(guild: string, user: string, name: string): Promise<void> {
	await env.SKM_KV.put(memberPrefix(guild) + user, "1", { metadata: { name } satisfies MemberMetadata });
}

/** 参加者なら登録時の表示名、参加者でなければ null */
export async function getMemberName(guild: string, user: string): Promise<string | null> {
	const { value, metadata } = await env.SKM_KV.getWithMetadata<MemberMetadata>(memberPrefix(guild) + user);
	return value === null ? null : (metadata?.name ?? user);
}

export async function listMembers(guild: string): Promise<Set<string>> {
	const prefix = memberPrefix(guild);
	const keys = await listAll<MemberMetadata>(prefix);
	return new Set(keys.map((key) => key.name.slice(prefix.length)));
}

/** 集計対象から外し、全月の登録も削除する */
export async function removeUser(guild: string, user: string): Promise<void> {
	const busyKeys = await listAll(`busy:${guild}:`);
	const targets = busyKeys.map((key) => key.name).filter((name) => name.endsWith(`:${user}`));
	await Promise.all([memberPrefix(guild) + user, ...targets].map((key) => env.SKM_KV.delete(key)));
}

export async function getConfig(guild: string): Promise<ReminderConfig | null> {
	return env.SKM_KV.get<ReminderConfig>(configKey(guild), "json");
}

export async function putConfig(guild: string, config: ReminderConfig): Promise<void> {
	await env.SKM_KV.put(configKey(guild), JSON.stringify(config), {
		metadata: { hour: config.hour, enabled: config.enabled } satisfies ConfigMetadata,
	});
}

/** 指定した時刻にリマインドが有効なサーバー ID の一覧 */
export async function listGuildsToRemind(hour: number): Promise<string[]> {
	const keys = await listAll<ConfigMetadata>("cfg:");
	return keys
		.filter((key) => key.metadata?.enabled && key.metadata.hour === hour)
		.map((key) => key.name.slice("cfg:".length));
}
