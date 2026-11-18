// main.ts — the entrypoint: hands Surya Bay to make.fun.
// It copies game/ and screenshots/ into the output directory and writes
// /output/dossier.json with buildDossier from the kit's vendor library.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.
// Standard library only, no network, deterministic: two runs write the
// same bytes.
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const root = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR || "/output";

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, "game"), join(out, "game"), { recursive: true });
cpSync(join(root, "screenshots"), join(out, "screenshots"), { recursive: true });
const bytes = await buildDossier(root, { text_max_bytes: 163840 });
writeFileSync(join(out, "dossier.json"), Buffer.from(bytes));
console.log("wrote " + out + "/dossier.json (" + bytes.length + " bytes)");
