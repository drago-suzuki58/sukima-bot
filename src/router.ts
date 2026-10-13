import {
	type APIApplicationCommandInteractionDataOption,
	type APIInteraction,
	type APIInteractionResponse,
	ApplicationCommandOptionType,
	ApplicationCommandType,
	InteractionResponseType,
	InteractionType,
	PermissionFlagsBits,
} from "discord-api-types/v10";
import { BUSY_MODAL_PREFIX, openBusyModal, submitBusy } from "./commands/busy.ts";
import { type CommandHandler, type InteractionContext, reply } from "./commands/context.ts";
import { showFree } from "./commands/free.ts";
import { leave } from "./commands/leave.ts";
import { showMine } from "./commands/mine.ts";
import { monthChoices } from "./commands/month.ts";
import { setup, setupOff } from "./commands/setup.ts";
import { textMessage } from "./render.ts";
import { jstNow } from "./time.ts";

export const COMMAND_NAME = "skm";

const handlers: Record<string, CommandHandler> = {
	busy: openBusyModal,
	free: showFree,
	mine: showMine,
	leave,
	setup,
	"setup-off": setupOff,
};

const GUILD_ONLY = reply(textMessage("このコマンドはサーバー内でのみ使えます"));
const UNKNOWN = reply(textMessage("不明な操作です"));

function interactionContext(interaction: APIInteraction): InteractionContext | null {
	const { guild_id: guildId, member } = interaction;
	if (!guildId || !member) return null;
	const manage = PermissionFlagsBits.ManageGuild | PermissionFlagsBits.Administrator;
	return {
		guildId,
		userId: member.user.id,
		displayName: member.nick ?? member.user.global_name ?? member.user.username,
		canManageGuild: (BigInt(member.permissions) & manage) !== 0n,
		now: jstNow(),
	};
}

/** `/skm <sub>` のサブコマンドを取り出す */
function subcommandOf(options: APIApplicationCommandInteractionDataOption[] | undefined) {
	const sub = options?.[0];
	return sub?.type === ApplicationCommandOptionType.Subcommand ? sub : undefined;
}

export async function handleInteraction(interaction: APIInteraction): Promise<APIInteractionResponse> {
	if (interaction.type === InteractionType.Ping) return { type: InteractionResponseType.Pong };

	const ctx = interactionContext(interaction);

	switch (interaction.type) {
		case InteractionType.ApplicationCommand: {
			if (!ctx) return GUILD_ONLY;
			const { data } = interaction;
			if (data.type !== ApplicationCommandType.ChatInput || data.name !== COMMAND_NAME) return UNKNOWN;
			const sub = subcommandOf(data.options);
			const handler = sub && handlers[sub.name];
			if (!handler) return UNKNOWN;
			const options = new Map((sub.options ?? []).map((option) => [option.name, option.value]));
			return handler({ ...ctx, options });
		}
		case InteractionType.ApplicationCommandAutocomplete: {
			const focused = subcommandOf(interaction.data.options)?.options?.find((option) => "focused" in option && option.focused);
			const choices = ctx && focused?.name === "month" ? monthChoices(String(focused.value), ctx.now) : [];
			return { type: InteractionResponseType.ApplicationCommandAutocompleteResult, data: { choices } };
		}
		case InteractionType.ModalSubmit: {
			if (!ctx) return GUILD_ONLY;
			const { custom_id: customId, components } = interaction.data;
			if (customId.startsWith(BUSY_MODAL_PREFIX)) return submitBusy(ctx, customId, components);
			return UNKNOWN;
		}
		default:
			return UNKNOWN;
	}
}
