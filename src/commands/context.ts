import { type APIInteractionResponse, InteractionResponseType } from "discord-api-types/v10";
import type { V2Message } from "../render.ts";
import type { JstDate } from "../time.ts";

export interface InteractionContext {
	guildId: string;
	userId: string;
	displayName: string;
	canManageGuild: boolean;
	now: JstDate;
}

export interface CommandContext extends InteractionContext {
	/** サブコマンドのオプション */
	options: Map<string, string | number | boolean>;
}

export type CommandHandler = (ctx: CommandContext) => Promise<APIInteractionResponse>;

export function reply(message: V2Message): APIInteractionResponse {
	return { type: InteractionResponseType.ChannelMessageWithSource, data: message };
}
