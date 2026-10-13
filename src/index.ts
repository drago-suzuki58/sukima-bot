import { env } from "cloudflare:workers";
import type { APIInteraction } from "discord-api-types/v10";
import { Hono } from "hono";
import { runReminders } from "./cron.ts";
import { reply } from "./commands/context.ts";
import { textMessage } from "./render.ts";
import { handleInteraction } from "./router.ts";
import { verifyDiscordRequest } from "./verify.ts";

const app = new Hono();

app.get("/", (c) => c.text("Sukima is running"));

// Discord の Interactions Endpoint
app.post("/", async (c) => {
	const body = await c.req.text();
	const verified = await verifyDiscordRequest(
		env.DISCORD_PUBLIC_KEY,
		c.req.header("X-Signature-Ed25519"),
		c.req.header("X-Signature-Timestamp"),
		body,
	);
	if (!verified) return c.text("invalid request signature", 401);

	try {
		return c.json(await handleInteraction(JSON.parse(body) as APIInteraction));
	} catch (error) {
		console.error("Interaction の処理に失敗しました", error);
		return c.json(reply(textMessage("エラーが発生しました。時間をおいてもう一度お試しください")));
	}
});

export default {
	fetch: app.fetch,
	scheduled(controller, _env, ctx) {
		ctx.waitUntil(runReminders(controller.scheduledTime));
	},
} satisfies ExportedHandler;
