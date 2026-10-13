import { bindings, defineConfig, triggers } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

export default defineConfig({
	worker: {
		name: "sukima-bot",
		compatibilityDate: "2026-09-28",
		entrypoint,
		env: {
			SKM_KV: bindings.kv({ id: "c1b863cafd4641b28371e4a5342babb5" }),
			DISCORD_PUBLIC_KEY: bindings.secret(),
			DISCORD_BOT_TOKEN: bindings.secret(),
			DISCORD_APPLICATION_ID: bindings.secret(),
		},
		// 毎時起動し、設定時刻（JST）が一致するサーバーにだけリマインドを送る
		triggers: [triggers.scheduled({ schedule: "0 * * * *" })],
		observability: { enabled: true },
	},
});
