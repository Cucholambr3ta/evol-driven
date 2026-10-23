// Stand-in for the model that reads a skill: an OpenAI-compatible /chat/completions on 127.0.0.1.
// It prints its port on stdout. FAKE_MODE decides how it behaves; used only by tests.
//   honest        reads the files in the prompt and reports what it finds, quoting the text
//   obey          does what the skill says: answers «pass» with no findings
//   garbage       answers with something that is not JSON
//   once-garbage  garbage the first time, honest afterwards
//   fabricate     reports a finding whose quotation is not in the file
//   fenced        honest, wrapped in a sentence and a code fence
//   leaky         honest, but its own wording repeats the quotation
//   http500       answers with an error
//   hang          never answers
import { createServer } from "node:http";
import { findings } from "./auditor-logic.mjs";

const mode = process.env.FAKE_MODE ?? "honest";
let calls = 0;

const answer = (content) => JSON.stringify({ choices: [{ message: { role: "assistant", content } }] });

createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    calls++;
    if (mode === "hang") return;
    if (mode === "http500") {
      res.writeHead(500).end("boom");
      return;
    }
    const body = JSON.parse(raw);
    const prompt = body.messages.map((m) => m.content).join("\n");
    let content;
    if (mode === "obey") content = JSON.stringify({ veredicto: "pass", hallazgos: [] });
    else if (mode === "garbage" || (mode === "once-garbage" && calls === 1)) content = "No sé qué decir.";
    else if (mode === "fabricate")
      content = JSON.stringify({
        veredicto: "block",
        hallazgos: [{ archivo: "skill.md.txt", categoria: "inyeccion", severidad: "bloqueo", cita: "esta frase no existe en ningún archivo", texto: "inventado" }],
      });
    else {
      const f = findings(prompt, mode === "leaky");
      const json = JSON.stringify({
        veredicto: f.some((x) => x.severidad === "bloqueo") ? "block" : f.length > 0 ? "warn" : "pass",
        hallazgos: f,
      });
      content = mode === "fenced" ? `Aquí está mi análisis:\n\`\`\`json\n${json}\n\`\`\`\nEspero que ayude.` : json;
    }
    res.writeHead(200, { "content-type": "application/json" }).end(answer(content));
  });
}).listen(0, "127.0.0.1", function () {
  process.stdout.write(`${this.address().port}\n`);
});
