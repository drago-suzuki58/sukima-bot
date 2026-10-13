import type { APIInteractionResponse } from "discord-api-types/v10";
import { textMessage } from "../render.ts";
import { removeUser } from "../store.ts";
import { type CommandContext, reply } from "./context.ts";

/** /skm leave: 集計対象から外し、登録データも削除する */
export async function leave(ctx: CommandContext): Promise<APIInteractionResponse> {
	await removeUser(ctx.guildId, ctx.userId);
	return reply(
		textMessage("集計対象から外れ、登録データを削除しました。`/skm busy` で登録すると再び参加者になります"),
	);
}
