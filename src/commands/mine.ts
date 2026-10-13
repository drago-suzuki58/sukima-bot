import type { APIInteractionResponse } from "discord-api-types/v10";
import { formatDays } from "../parse.ts";
import { textMessage } from "../render.ts";
import { getBusy } from "../store.ts";
import { formatMonth } from "../time.ts";
import { type CommandContext, reply } from "./context.ts";
import { INVALID_MONTH, resolveMonth } from "./month.ts";

/** /skm mine: 自分の登録内容を確認する */
export async function showMine(ctx: CommandContext): Promise<APIInteractionResponse> {
	const ym = resolveMonth(ctx.options.get("month"), ctx.now);
	if (!ym) return reply(textMessage(INVALID_MONTH));

	const days = await getBusy(ctx.guildId, ym, ctx.userId);
	return reply(
		textMessage(
			days.length > 0
				? `${formatMonth(ym)}の忙しい日（${days.length} 日）: ${formatDays(days)}`
				: `${formatMonth(ym)}の登録はありません。\`/skm busy\` で登録できます`,
		),
	);
}
