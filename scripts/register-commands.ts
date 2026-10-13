// /skm コマンドを Discord に登録する。
// DISCORD_GUILD_ID を指定するとギルドコマンドとして登録し、即座に反映される（開発向け）。
// 使い方: pnpm register-commands
import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	ApplicationIntegrationType,
	ChannelType,
	InteractionContextType,
	type RESTPutAPIApplicationCommandsJSONBody,
} from "discord-api-types/v10";

const { DISCORD_APPLICATION_ID, DISCORD_BOT_TOKEN, DISCORD_GUILD_ID } = process.env;
if (!DISCORD_APPLICATION_ID || !DISCORD_BOT_TOKEN) {
	console.error("DISCORD_APPLICATION_ID と DISCORD_BOT_TOKEN を .env に設定してください");
	process.exit(1);
}

const month = {
	type: ApplicationCommandOptionType.String,
	name: "month",
	description: "対象月（YYYY-MM）。省略すると今月",
	autocomplete: true,
} as const;

const commands: RESTPutAPIApplicationCommandsJSONBody = [
	{
		type: ApplicationCommandType.ChatInput,
		name: "skm",
		description: "Sukima: みんなの空き日を調整します",
		integration_types: [ApplicationIntegrationType.GuildInstall],
		contexts: [InteractionContextType.Guild],
		options: [
			{
				type: ApplicationCommandOptionType.Subcommand,
				name: "busy",
				description: "忙しい日を登録する",
				options: [month],
			},
			{
				type: ApplicationCommandOptionType.Subcommand,
				name: "free",
				description: "全員の空き状況をカレンダーで表示する",
				options: [
					month,
					{
						type: ApplicationCommandOptionType.User,
						name: "user",
						description: "指定するとその人の予定を表示する",
					},
				],
			},
			{
				type: ApplicationCommandOptionType.Subcommand,
				name: "mine",
				description: "自分の登録内容を確認する",
				options: [month],
			},
			{
				type: ApplicationCommandOptionType.Subcommand,
				name: "leave",
				description: "集計対象から外れる（登録データも削除する）",
			},
			{
				type: ApplicationCommandOptionType.Subcommand,
				name: "setup",
				description: "リマインドの投稿先と時刻を設定する（サーバー管理権限が必要）",
				options: [
					{
						type: ApplicationCommandOptionType.Channel,
						name: "channel",
						description: "投稿先チャンネル",
						channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
						required: true,
					},
					{
						type: ApplicationCommandOptionType.Integer,
						name: "hour",
						description: "投稿する時（日本時間 0-23）。省略すると 8 時",
						min_value: 0,
						max_value: 23,
					},
				],
			},
			{
				type: ApplicationCommandOptionType.Subcommand,
				name: "setup-off",
				description: "リマインドを停止する（サーバー管理権限が必要）",
			},
		],
	},
];

const path = DISCORD_GUILD_ID
	? `applications/${DISCORD_APPLICATION_ID}/guilds/${DISCORD_GUILD_ID}/commands`
	: `applications/${DISCORD_APPLICATION_ID}/commands`;

const response = await fetch(`https://discord.com/api/v10/${path}`, {
	method: "PUT",
	headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
	body: JSON.stringify(commands),
});

if (!response.ok) {
	console.error(`登録に失敗しました: ${response.status}\n${await response.text()}`);
	process.exit(1);
}
console.log(`${DISCORD_GUILD_ID ? `ギルド ${DISCORD_GUILD_ID} に` : "グローバルに"}コマンドを登録しました`);
