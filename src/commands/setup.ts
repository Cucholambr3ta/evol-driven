import { userInfo } from "node:os";
import { parseArgs } from "node:util";
import { UserError } from "../core/errors.js";
import { packageRoot } from "../core/paths.js";
import { libraryDir } from "../skills/library.js";
import { listSkills } from "../skills/library.js";
import { readManifest, auditState } from "../skills/manifest.js";
import { COMPONENTS, findTool } from "../setup/catalog.js";
import { nodeOk, seedLibrary, setupReader, setupTools } from "../setup/steps.js";
import type { Prompter } from "../setup/steps.js";
import { join } from "node:path";
import { out } from "./shared.js";
import { hasTerminal, typingSession } from "./tty.js";

const USAGE = "Uso: evol setup [--comprobar] [--sin-herramientas] [--sin-skills]";

/** A yes/no question answered at the terminal; anything but «s», «si» or «sí» is no. */
function terminalPrompter(): { prompter: Prompter; close: () => void } {
  const session = typingSession();
  return {
    prompter: {
      yesNo: async (question) => {
        const answer = (await session.ask(question))?.trim().toLowerCase();
        return (
          answer === "s" || answer === "si" || answer === "sí" || answer === "y" || answer === "yes"
        );
      },
    },
    close: () => session.close(),
  };
}

function check(): number {
  out(`Node ${process.versions.node}: ${nodeOk() ? "✓" : "× hace falta 24 o superior"}`);
  for (const c of COMPONENTS)
    out(
      `  ${findTool(c) ? "✓" : c.necesidad === "obligatoria" ? "×" : "!"} ${c.id} (${c.necesidad}: ${c.uso})`,
    );
  const skills = listSkills(join(packageRoot(), "skills"));
  const library = listSkills(libraryDir());
  out(
    `Skills del paquete: ${skills.length}; en tu biblioteca (${libraryDir()}): ${library.length}`,
  );
  out("Solo se ha comprobado. Para instalar lo que falta: evol setup");
  return 0;
}

export default async function run(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      comprobar: { type: "boolean" },
      "sin-herramientas": { type: "boolean" },
      "sin-skills": { type: "boolean" },
    },
  });
  if (values.comprobar === true) return check();
  if (!hasTerminal())
    throw new UserError(
      `evol setup pregunta antes de instalar: ejecútalo en una terminal (o usa --comprobar). ${USAGE}`,
    );

  const { prompter, close } = terminalPrompter();
  try {
    out(
      "evol setup: pregunta antes de cada instalación; no usa sudo y no aprueba ninguna skill.\n",
    );
    out(
      `1. Requisitos: Node ${process.versions.node} ${nodeOk() ? "✓" : "× hace falta 24 o superior"}`,
    );
    if (values["sin-herramientas"] !== true) {
      out("\n2. Herramientas");
      await setupTools(out, prompter);
    }
    out("\n3. Lector de la auditoría de skills");
    await setupReader(out, prompter, findTool({ id: "claude", bin: "claude" }));

    if (values["sin-skills"] !== true) {
      out("\n4. Biblioteca de skills");
      const source = join(packageRoot(), "skills");
      const seeded = seedLibrary(source, libraryDir(), userInfo().username);
      out(
        `  ${seeded.copiadas.length} copiadas a ${libraryDir()}, ${seeded.iguales.length} ya estaban`,
      );
      if (seeded.distintas.length > 0)
        out(
          `  ! ${seeded.distintas.length} tienen el mismo nombre que una tuya y otro contenido; no se tocaron: ${seeded.distintas.join(", ")}`,
        );
      if (seeded.aprobacionesConservadas.length > 0)
        out(
          `  ✓ ${seeded.aprobacionesConservadas.length} conservan la aprobación que diste tú en esta máquina`,
        );
      const manifest = readManifest(libraryDir());
      const pending = listSkills(libraryDir()).filter((s) => {
        const state = auditState(s, manifest.skills[s.id]);
        return state !== "aprobada" && state !== "con-avisos";
      });
      out(
        `  Sin aprobar: ${pending.length}. Auditarlas y aprobarlas lo haces tú, una a una: evol skills audit <carpeta> --propia --subproceso y evol skills approve <nombre>.`,
      );
    }
    out(
      "\nListo. Siguiente: en un proyecto, evol init (o /evol en tu IDE) y evol agents --ide <id>.",
    );
    return 0;
  } finally {
    close();
  }
}
