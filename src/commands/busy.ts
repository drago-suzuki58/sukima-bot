import {
	type APIInteractionResponse,
	type APIModalSubmissionComponent,
	ComponentType,
	InteractionResponseType,
	TextInputStyle,
} from "discord-api-types/v10";
import { formatDays, parseDays } from "../parse.ts";
import { textMessage } from "../render.ts";
import { getBusy, putBusy, putMember } from "../store.ts";
import { compareMonths, formatMonth, monthKey, parseMonth } from "../time.ts";
import { type CommandContext, type InteractionContext, reply } from "./context.ts";
import { INVALID_MONTH, resolveMonth } from "./month.ts";

/** モーダルの custom_id。対象月を埋め込む（例: `skm:busy:2026-11`） */
export const BUSY_MODAL_PREFIX = "skm:busy:";
const DAYS_INPUT_ID = "days";

/** /skm busy: 既存の登録を初期値に入れたモーダルを開く */
export async function openBusyModal(ctx: CommandContext): Promise<APIInteractionResponse> {
	const ym = resolveMonth(ctx.options.get("month"), ctx.now);
	if (!ym) return reply(textMessage(INVALID_MONTH));
	if (compareMonths(ym, ctx.now) < 0) return reply(textMessage("過去の月は登録できません"));

	const days = await getBusy(ctx.guildId, ym, ctx.userId);
	return {
		type: InteractionResponseType.Modal,
		data: {
			custom_id: BUSY_MODAL_PREFIX + monthKey(ym),
			title: `忙しい日（${formatMonth(ym)}）`,
			components: [
				{
					type: ComponentType.Label,
					label: "忙しい日",
					description: "カンマ区切りで入力し、範囲は 12-14 のように指定します。空欄で送信するとこの月の登録を削除します",
					component: {
						type: ComponentType.TextInput,
						custom_id: DAYS_INPUT_ID,
						style: TextInputStyle.Paragraph,
						required: false,
						max_length: 1000,
						placeholder: "3, 5, 12-14",
						...(days.length > 0 && { value: formatDays(days) }),
					},
				},
			],
		},
	};
}

function findInputValue(components: APIModalSubmissionComponent[]): string {
	for (const component of components) {
		if (component.type === ComponentType.Label && component.component.type === ComponentType.TextInput) {
			if (component.component.custom_id === DAYS_INPUT_ID) return component.component.value;
		}
	}
	return "";
}

/** モーダル送信: その月の登録を丸ごと置き換える */
export async function submitBusy(
	ctx: InteractionContext,
	customId: string,
	components: APIModalSubmissionComponent[],
): Promise<APIInteractionResponse> {
	const ym = parseMonth(customId.slice(BUSY_MODAL_PREFIX.length));
	if (!ym) return reply(textMessage("対象月を読み取れませんでした。もう一度 `/skm busy` を実行してください"));

	const { days, invalid } = parseDays(findInputValue(components), ym.year, ym.month);
	await Promise.all([
		putBusy(ctx.guildId, ym, ctx.userId, days),
		putMember(ctx.guildId, ctx.userId, ctx.displayName),
	]);

	const lines = [
		days.length > 0
			? `${formatMonth(ym)}の忙しい日を登録しました: ${formatDays(days)}`
			: `${formatMonth(ym)}の登録をすべて削除しました`,
	];
	if (invalid.length > 0) {
		lines.push(`解釈できなかったため無視した入力: ${invalid.map((token) => `\`${token.replaceAll("`", "")}\``).join(", ")}`);
	}
	return reply(textMessage(lines.join("\n")));
}
