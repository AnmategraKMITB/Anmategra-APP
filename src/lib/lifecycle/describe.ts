import { type Lifecycle, type Move } from './define';

export type LifecycleDescription = {
  name: string;
  states: string[];
  /** `guarded`: perpindahan bersyarat; `when` menjelaskan syaratnya. */
  moves: { from: string; to: string; guarded?: true; when?: string }[];
};

/** Bentuk data siklus hidup untuk `docs/api/lifecycles.json`. */
export function describeLifecycle<S extends string, C>(
  lifecycle: Lifecycle<S, C>,
): LifecycleDescription {
  return {
    name: lifecycle.name,
    states: [...lifecycle.states],
    moves: lifecycle.states.flatMap((from) =>
      (Object.entries(lifecycle.moves[from]) as [S, Move<C>][]).map(
        ([to, move]) => ({
          from,
          to,
          ...(move.guard && { guarded: true as const }),
          ...(move.when && { when: move.when }),
        }),
      ),
    ),
  };
}

const mermaidId = (state: string) => state.replace(/[^A-Za-z0-9_]/g, '_');

/** Diagram keadaan Mermaid; syarat perpindahan menjadi label panah. */
export function toMermaid({ states, moves }: LifecycleDescription): string {
  return [
    'stateDiagram-v2',
    ...states
      .filter((state) => mermaidId(state) !== state)
      .map((state) => `  state "${state}" as ${mermaidId(state)}`),
    ...moves.map(
      ({ from, to, when }) =>
        `  ${mermaidId(from)} --> ${mermaidId(to)}${when ? `: ${when}` : ''}`,
    ),
  ].join('\n');
}
