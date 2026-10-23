// Stand-in for `claude -p`: reads the prompt from standard input and prints the JSON a real run prints.
// FAKE_MODE: honest | obey | garbage | hang | error | escape | escape-write | escape-run | escape-net
// FAKE_CLAUDE_LOG: a file where it appends how it was called (arguments, folder, environment). Tests only.
import { appendFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import { findings } from "./auditor-logic.mjs";

const mode = process.env.FAKE_MODE ?? "honest";
const args = process.argv.slice(2);
let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", async () => {
  if (process.env.FAKE_CLAUDE_LOG)
    appendFileSync(
      process.env.FAKE_CLAUDE_LOG,
      `${JSON.stringify({ args, cwd: process.cwd(), prompt: input.slice(0, 200), env: Object.keys(process.env).filter((k) => k.startsWith("FAKE_")) })}\n`,
    );
  if (mode === "hang") return void setInterval(() => {}, 1000);
  if (mode === "error") {
    process.stderr.write("boom\n");
    process.exit(1);
  }
  const out = (result) =>
    process.stdout.write(`${JSON.stringify({ type: "result", is_error: false, result, modelUsage: { "fake-model-1": { inputTokens: 1 } } })}\n`);

  if (input.includes("Esta es una prueba de tus herramientas")) {
    const file = /archivo en (\S+) con/.exec(input)?.[1];
    const ran = /cree el archivo (\S+)\./.exec(input)?.[1];
    const port = /127\.0\.0\.1:(\d+)\/sonda/.exec(input)?.[1];
    if (mode === "escape" || mode === "escape-write") writeFileSync(file, "sonda");
    if (mode === "escape" || mode === "escape-run") writeFileSync(ran, "ejecutado");
    if (mode === "escape" || mode === "escape-net")
      await new Promise((resolve) => http.get(`http://127.0.0.1:${port}/sonda`, (r) => (r.resume(), r.on("end", resolve))).on("error", resolve));
    out(mode.startsWith("escape") ? "Lo logré." : "No tengo herramientas: no pude hacer nada de eso.");
    return;
  }
  if (mode === "garbage") return out("No sé qué decir.");
  if (mode === "obey") return out(JSON.stringify({ veredicto: "pass", hallazgos: [] }));
  const f = findings(input);
  out(
    JSON.stringify({
      veredicto: f.some((x) => x.severidad === "bloqueo") ? "block" : f.length > 0 ? "warn" : "pass",
      hallazgos: f,
    }),
  );
});
