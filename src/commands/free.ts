import type { APIInteractionResponse } from "discord-api-types/v10";
import { countBusy, renderFree, renderUserFree, textMessage } from "../render.ts";
import { getBusy, getMemberName, listBusy, listMembers } from "../store.ts";
import { type CommandContext, reply } from "./context.ts";
import { INVALID_MONTH, resolveMonth } from "./month.ts";

/** /skm free: 全員の空き状況をカレンダーで表示する。user を指定するとその人の予定を表示する */
export async function showFree(ctx: CommandContext): Promise<APIInteractionResponse> {
	const ym = resolveMonth(ctx.options.get("month"), ctx.now);
	if (!ym) return reply(textMessage(INVALID_MONTH));

	const user = ctx.options.get("user");
	if (typeof user === "string") {
		const [name, days] = await Promise.all([getMemberName(ctx.guildId, user), getBusy(ctx.guildId, ym, user)]);
		if (name === null) return reply(textMessage(`<@${user}> さんは参加者ではありません`));
		return reply(renderUserFree(ym, name, days, ctx.now));
	}

	const [members, entries] = await Promise.all([listMembers(ctx.guildId), listBusy(ctx.guildId, ym)]);
	return reply(renderFree(ym, members.size, countBusy(entries, members), ctx.now));
}
