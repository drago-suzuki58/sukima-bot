import type { APIInteractionResponse } from "discord-api-types/v10";
import { countBusy, renderFree, textMessage } from "../render.ts";
import { listBusy, listMembers } from "../store.ts";
import { type CommandContext, reply } from "./context.ts";
import { INVALID_MONTH, resolveMonth } from "./month.ts";

/** /skm free: 全員の空き状況をカレンダーで表示する */
export async function showFree(ctx: CommandContext): Promise<APIInteractionResponse> {
	const ym = resolveMonth(ctx.options.get("month"), ctx.now);
	if (!ym) return reply(textMessage(INVALID_MONTH));

	const [members, entries] = await Promise.all([listMembers(ctx.guildId), listBusy(ctx.guildId, ym)]);
	return reply(renderFree(ym, members.size, countBusy(entries, members), ctx.now));
}
