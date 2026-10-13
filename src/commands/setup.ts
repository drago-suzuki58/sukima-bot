import type { APIInteractionResponse } from "discord-api-types/v10";
import { textMessage } from "../render.ts";
import { getConfig, putConfig } from "../store.ts";
import { type CommandContext, reply } from "./context.ts";

export const DEFAULT_REMINDER_HOUR = 8;

// default_member_permissions はトップレベルの /skm にしか付けられないため、サブコマンド側で権限を確かめる
const PERMISSION_DENIED = "このコマンドを使うには「サーバー管理」権限が必要です";

/** /skm setup: リマインドの投稿先チャンネルと時刻を設定する */
export async function setup(ctx: CommandContext): Promise<APIInteractionResponse> {
	if (!ctx.canManageGuild) return reply(textMessage(PERMISSION_DENIED));

	const channelId = String(ctx.options.get("channel"));
	const hour = Number(ctx.options.get("hour") ?? DEFAULT_REMINDER_HOUR);
	await putConfig(ctx.guildId, { channelId, hour, enabled: true, failures: 0 });
	return reply(
		textMessage(
			`毎日 ${hour} 時（日本時間）に <#${channelId}> へリマインドを投稿します。\nBot がこのチャンネルを閲覧でき、メッセージを送信できることを確認してください`,
		),
	);
}

/** /skm setup-off: リマインドを停止する */
export async function setupOff(ctx: CommandContext): Promise<APIInteractionResponse> {
	if (!ctx.canManageGuild) return reply(textMessage(PERMISSION_DENIED));

	const config = await getConfig(ctx.guildId);
	if (!config?.enabled) return reply(textMessage("リマインドは設定されていません"));
	await putConfig(ctx.guildId, { ...config, enabled: false });
	return reply(textMessage("リマインドを停止しました。`/skm setup` で再開できます"));
}
