import { userInfo } from "node:os";
import { UserError } from "../core/errors.js";
import { recordInterrogation } from "../core/interrogation.js";
import { loadContext } from "../core/pipeline.js";
import { makeRecorder } from "../memory/events.js";
import { out, requireProject, warn } from "./shared.js";

export default async function run(argv: string[]): Promise<number> {
  const documento = argv[0];
  if (!documento)
    throw new UserError(
      "Uso: evol interrogate <documento>   (el documento con la sección «Interrogado»: lo preguntado y lo resuelto)",
    );
  const root = requireProject();
  const ctx = loadContext(root);
  ctx.record = makeRecorder(root, ctx.config, warn);
  const mark = recordInterrogation(ctx, documento, userInfo().username);
  await ctx.record("plan-interrogated", {
    documento: mark.documento,
    hash: mark.hash.slice(0, 16),
  });
  out(`Plan interrogado: queda anotado contra su contenido actual (${mark.hash.slice(0, 16)}…).`);
  out(`Quien apruebe el plan debe leer «${mark.documento}»; si el plan cambia, hay que repetirlo.`);
  return 0;
}
