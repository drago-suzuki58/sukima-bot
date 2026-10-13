import { defineConfig } from "vitest/config";

// vite.config.ts の Cloudflare プラグインを読み込まないよう、テストは素の Node で動かす
export default defineConfig({
	test: {
		include: ["test/**/*.test.ts"],
	},
});
