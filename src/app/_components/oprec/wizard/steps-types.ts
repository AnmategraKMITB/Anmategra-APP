import { type SetupTree, type WizardCtx, type WizardState } from './model';

/** Yang diterima tiap langkah: isian, cara mengubahnya, dan data organogram. */
export type StepProps = {
  s: WizardState;
  update: (patch: Partial<WizardState>) => void;
  c: WizardCtx;
  /** Organogram tiap periode sumber yang dipilih, sudah dimuat. */
  trees: { periodId: string; name: string; tree: SetupTree | null }[];
  sources: { periodId: string; name: string; lembagaName: string | null }[];
};
