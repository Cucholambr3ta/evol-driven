import type { PipelineContext } from "../core/pipeline.js";
import {
  activityDiagram,
  communicationDiagram,
  interactionOverviewDiagram,
  sequenceDiagram,
  stateMachineDiagram,
  timingDiagram,
  useCaseDiagram,
} from "./behavior.js";
import { collectInput } from "./data.js";
import { DIAGRAM_ORDER } from "./model.js";
import type { Diagram, DiagramInput, DiagramOptions } from "./model.js";
import {
  classDiagram,
  componentDiagram,
  compositeDiagram,
  deploymentDiagram,
  objectDiagram,
  packageDiagram,
  profileDiagram,
} from "./structural.js";

const GENERATORS: Record<number, (input: DiagramInput) => Diagram> = {
  1: classDiagram,
  2: objectDiagram,
  3: componentDiagram,
  4: compositeDiagram,
  5: packageDiagram,
  6: deploymentDiagram,
  7: profileDiagram,
  8: useCaseDiagram,
  9: activityDiagram,
  10: stateMachineDiagram,
  11: sequenceDiagram,
  12: communicationDiagram,
  13: timingDiagram,
  14: interactionOverviewDiagram,
};

export const DIAGRAM_COUNT = DIAGRAM_ORDER.length;

/** Generates the diagrams (all, or the numbers in `only`) from the project's real data. */
export function generateDiagrams(
  ctx: PipelineContext,
  options: DiagramOptions & { only?: number[] } = {},
): Diagram[] {
  const input = collectInput(ctx, options);
  const wanted = options.only ?? DIAGRAM_ORDER.map((_, i) => i + 1);
  return wanted.flatMap((n) => {
    const generate = GENERATORS[n];
    return generate ? [generate(input)] : [];
  });
}

export function diagramFileName(d: Diagram): string {
  return `${String(d.numero).padStart(2, "0")}-${d.clave}.svg`;
}

export type { Diagram, DiagramOptions } from "./model.js";
