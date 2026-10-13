// アプリ絵文字（曜日ヘッダーと、忙しい人数入りのマス）を生成して Discord に登録し、ID を src/emoji.json に書き出す。
// 使い方:
//   pnpm emoji --preview <dir>  画像を書き出すだけで、登録しない
//   pnpm emoji                  未登録の絵文字を登録する
//   pnpm emoji --force          登録済みの絵文字も作り直す（デザインを変えたとき）
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { Resvg } from "@resvg/resvg-js";
import { busyEmojiName, MAX_BUSY_EMOJI, weekdayEmojiName } from "../src/emoji.ts";
import { WEEKDAYS } from "../src/time.ts";

const FONT_URL = "https://github.com/notofonts/noto-cjk/raw/main/Sans/SubsetOTF/JP/NotoSansJP-Bold.otf";
const FONT_PATH = "node_modules/.cache/sukima/NotoSansJP-Bold.otf";
const OUTPUT_PATH = "src/emoji.json";

// 標準の 🟨 🟥 に色を合わせる。曜日はダーク・ライト両方のテーマで読める色にする
const COLORS = {
	few: { fill: "#FDCB58", text: "#3D3000" },
	many: { fill: "#DD2E44", text: "#FFFFFF" },
	weekday: "#8C8F96",
	saturday: "#3B88C3",
	sunday: "#DD2E44",
};

const text = (label: string, fontSize: number, fill: string) =>
	`<text x="64" y="64" text-anchor="middle" dominant-baseline="central" font-family="Noto Sans JP" font-weight="700" font-size="${fontSize}" fill="${fill}">${label}</text>`;
const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">${body}</svg>`;

function emojiSpecs(): Map<string, string> {
	const specs = new Map<string, string>();
	WEEKDAYS.forEach((day, i) => {
		const fill = i === 0 ? COLORS.sunday : i === 6 ? COLORS.saturday : COLORS.weekday;
		specs.set(weekdayEmojiName(i), svg(text(day, 104, fill)));
	});
	for (const level of ["few", "many"] as const) {
		const { fill, text: textColor } = COLORS[level];
		for (let count = 1; count <= MAX_BUSY_EMOJI; count++) {
			const label = String(count);
			specs.set(
				busyEmojiName(level, count),
				svg(`<rect x="4" y="4" width="120" height="120" rx="18" fill="${fill}"/>${text(label, label.length > 1 ? 80 : 96, textColor)}`),
			);
		}
	}
	return specs;
}

async function ensureFont(): Promise<void> {
	if (existsSync(FONT_PATH)) return;
	console.log("フォントを取得しています...");
	const response = await fetch(FONT_URL);
	if (!response.ok) throw new Error(`フォントを取得できません: ${response.status}`);
	await mkdir(dirname(FONT_PATH), { recursive: true });
	await writeFile(FONT_PATH, Buffer.from(await response.arrayBuffer()));
}

function renderPng(source: string): Buffer {
	const resvg = new Resvg(source, {
		font: { fontFiles: [FONT_PATH], loadSystemFonts: false, defaultFontFamily: "Noto Sans JP" },
	});
	return resvg.render().asPng();
}

async function discord(method: string, path: string, body?: unknown): Promise<unknown> {
	const { DISCORD_APPLICATION_ID, DISCORD_BOT_TOKEN } = process.env;
	for (;;) {
		const response = await fetch(`https://discord.com/api/v10/applications/${DISCORD_APPLICATION_ID}/${path}`, {
			method,
			headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		if (response.status === 429) {
			const { retry_after } = (await response.json()) as { retry_after: number };
			await new Promise((resolve) => setTimeout(resolve, retry_after * 1000));
			continue;
		}
		if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
		return response.status === 204 ? undefined : response.json();
	}
}

const { values } = parseArgs({ options: { preview: { type: "string" }, force: { type: "boolean", default: false } } });

await ensureFont();
const specs = emojiSpecs();

if (values.preview) {
	await mkdir(values.preview, { recursive: true });
	for (const [name, source] of specs) await writeFile(join(values.preview, `${name}.png`), renderPng(source));
	console.log(`${specs.size} 個の画像を ${values.preview} に書き出しました`);
	process.exit(0);
}

if (!process.env.DISCORD_APPLICATION_ID || !process.env.DISCORD_BOT_TOKEN) {
	console.error("DISCORD_APPLICATION_ID と DISCORD_BOT_TOKEN を .env に設定してください");
	process.exit(1);
}

const { items } = (await discord("GET", "emojis")) as { items: { id: string; name: string }[] };
const existing = new Map(items.map((emoji) => [emoji.name, emoji.id]));
const ids: Record<string, string> = {};
let created = 0;

for (const [name, source] of specs) {
	let id = existing.get(name);
	if (id && values.force) {
		await discord("DELETE", `emojis/${id}`);
		id = undefined;
	}
	if (!id) {
		const image = `data:image/png;base64,${renderPng(source).toString("base64")}`;
		id = ((await discord("POST", "emojis", { name, image })) as { id: string }).id;
		created++;
	}
	ids[name] = id;
}

const previous = existsSync(OUTPUT_PATH) ? await readFile(OUTPUT_PATH, "utf8") : "";
const next = `${JSON.stringify(ids, null, "\t")}\n`;
if (next !== previous) await writeFile(OUTPUT_PATH, next);
console.log(`${created} 個を登録しました（全 ${specs.size} 個）。ID を ${OUTPUT_PATH} に書き出しました`);
