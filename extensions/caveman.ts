/**
 * pi-caveman — why use many token when few do trick
 *
 * A pi extension that cuts ~75% of output tokens while keeping full technical
 * accuracy. Based on https://github.com/JuliusBrussee/caveman
 *
 * Commands:
 *   /caveman [level]  Toggle caveman mode or set intensity
 *                     Levels: lite | full | ultra | wenyan-lite | wenyan | wenyan-ultra | off
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const LEVELS = ["off", "lite", "full", "ultra", "wenyan-lite", "wenyan", "wenyan-ultra"] as const;
type Level = (typeof LEVELS)[number];

const LABELS: Record<Level, string> = {
	off: "",
	lite: "🪶 Lite",
	full: "🪨 Full",
	ultra: "🔥 Ultra",
	"wenyan-lite": "📜 文言文 Lite",
	wenyan: "📜 文言文",
	"wenyan-ultra": "📜 文言文 Ultra",
};

// ---------------------------------------------------------------------------
// System prompt fragments
// ---------------------------------------------------------------------------

const BASE = `\
IMPORTANT: You are in CAVEMAN MODE. Respond terse like smart caveman. \
All technical substance stay. Only fluff die.

Rules:
- Drop articles (a/an/the), filler (just/really/basically/actually/simply), \
pleasantries, hedging
- Fragments OK. Short synonyms preferred. Technical terms exact
- Code blocks unchanged. Errors quoted exact
- Pattern: [thing] [action] [reason]. [next step].

Bad: "Sure! I'd be happy to help you with that. The issue you're experiencing is likely caused by..."
Good: "Bug in auth middleware. Token expiry check use \`<\` not \`<=\`. Fix:"`;

const INTENSITY: Record<Exclude<Level, "off">, string> = {
	lite: `\
Level: LITE — No filler/hedging. Keep articles + full sentences. Professional but tight.
Example: "Your component re-renders because you create a new object reference each render. Wrap it in \`useMemo\`."`,

	full: `\
Level: FULL — Drop articles, fragments OK, short synonyms. Classic caveman.
Example: "New object ref each render. Inline object prop = new ref = re-render. Wrap in \`useMemo\`."`,

	ultra: `\
Level: ULTRA — Abbreviate (DB/auth/config/req/res/fn/impl), strip conjunctions, arrows for causality (X → Y).
Example: "Inline obj prop → new ref → re-render. \`useMemo\`."`,

	"wenyan-lite": `\
Level: 文言文 LITE — Semi-classical Chinese. Grammar intact, filler gone. Technical terms in English.
Example: "組件頻重繪，以每繪新生對象參照故。以 useMemo 包之。"`,

	wenyan: `\
Level: 文言文 FULL — Maximum classical terseness. 80-90% character reduction. Technical terms in English.
Example: "物出新參照，致重繪。useMemo Wrap之。"`,

	"wenyan-ultra": `\
Level: 文言文 ULTRA — Extreme classical compression. Technical terms in English.
Example: "新參照→重繪。useMemo Wrap。"`,
};

const SAFETY = `\
Auto-clarity: drop caveman for security warnings, irreversible action confirmations, \
or when user is confused. Resume after.
Boundaries: write normal code. Only compress explanations. "stop caveman" or "normal mode" reverts.`;

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function caveman(pi: ExtensionAPI) {
	let level: Level = "off";

	// -- Restore persisted level on session load --

	pi.on("session_start", async (_event, ctx) => {
		for (const entry of ctx.sessionManager.getEntries()) {
			if (entry.type === "custom" && entry.customType === "caveman-level") {
				level = (entry.data as { level: Level })?.level ?? "off";
			}
		}
		syncStatus(ctx);
	});

	// -- /caveman command --

	pi.registerCommand("caveman", {
		description: "Toggle caveman mode or set level: lite, full, ultra, wenyan-lite, wenyan, wenyan-ultra, off",
		handler: async (args, ctx) => {
			const arg = args?.trim().toLowerCase();

			if (!arg) {
				level = level === "off" ? "full" : "off";
			} else if (LEVELS.includes(arg as Level)) {
				level = arg as Level;
			} else {
				ctx.ui.notify(`Unknown level "${arg}". Options: ${LEVELS.join(", ")}`, "error");
				return;
			}

			pi.appendEntry("caveman-level", { level });
			syncStatus(ctx);

			ctx.ui.notify(
				level === "off" ? "Caveman mode off." : `Caveman mode: ${LABELS[level]}`,
				"info",
			);
		},
	});

	// -- Inject caveman rules into system prompt --

	pi.on("before_agent_start", async (event) => {
		if (level === "off") return;
		return {
			systemPrompt: `${event.systemPrompt}\n\n${BASE}\n\n${INTENSITY[level]}\n\n${SAFETY}`,
		};
	});

	// -- Helpers --

	function syncStatus(ctx: { ui: { setStatus(id: string, text: string): void } }) {
		ctx.ui.setStatus("caveman", LABELS[level]);
	}
}
