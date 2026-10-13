const encoder = new TextEncoder();

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | null {
	if (!/^(?:[0-9a-fA-F]{2})+$/.test(hex)) return null;
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	return bytes;
}

const keyCache = new Map<string, Promise<CryptoKey>>();

function importPublicKey(publicKeyHex: string): Promise<CryptoKey> {
	let key = keyCache.get(publicKeyHex);
	if (!key) {
		const raw = hexToBytes(publicKeyHex);
		if (!raw) throw new Error("DISCORD_PUBLIC_KEY が 16 進文字列ではありません");
		key = crypto.subtle.importKey("raw", raw, { name: "Ed25519" }, false, ["verify"]);
		keyCache.set(publicKeyHex, key);
	}
	return key;
}

/** Discord の Interaction リクエストの Ed25519 署名を検証する */
export async function verifyDiscordRequest(
	publicKeyHex: string,
	signatureHex: string | undefined,
	timestamp: string | undefined,
	body: string,
): Promise<boolean> {
	const signature = signatureHex && hexToBytes(signatureHex);
	if (!signature || !timestamp) return false;
	return crypto.subtle.verify(
		{ name: "Ed25519" },
		await importPublicKey(publicKeyHex),
		signature,
		encoder.encode(timestamp + body),
	);
}
