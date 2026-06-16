import type { BusinessSetupLayoutStep } from './BusinessSetupLayout';

export type BusinessSetupFlowStep<TStepId extends string> = {
  id: TStepId;
  title: string;
  desc: string;
  summary: string;
};

export function buildBusinessSetupLayoutSteps<TStepId extends string>({
  activeStepId,
  activeStepIndex,
  finalStepId,
  highestUnlockedStepIndex,
  isStepValid,
  steps,
}: {
  activeStepId: TStepId;
  activeStepIndex: number;
  finalStepId: TStepId;
  highestUnlockedStepIndex: number;
  isStepValid: (stepId: TStepId) => boolean;
  steps: Array<BusinessSetupFlowStep<TStepId>>;
}): BusinessSetupLayoutStep[] {
  return steps.map((step, index) => ({
    id: step.id,
    title: step.title,
    desc: step.desc,
    summary: step.summary,
    active: step.id === activeStepId,
    done:
      index < activeStepIndex ||
      (index === activeStepIndex &&
        step.id !== finalStepId &&
        isStepValid(step.id)),
    unlocked: index <= highestUnlockedStepIndex,
  }));
}

export function createBusinessSetupPreview({
  categoryLabel,
  description,
  isId,
  title,
}: {
  categoryLabel: string;
  description: string;
  isId: boolean;
  title: string;
}) {
  return {
    title,
    fallbackTitle: isId ? 'Nama usaha' : 'Business name',
    categoryLabel,
    description,
    fallbackDescription: isId
      ? 'Deskripsi usaha akan tampil di sini.'
      : 'The business description will appear here.',
  };
}

export function createBusinessSetupTips(isId: boolean): string[] {
  return isId
    ? [
        'Gunakan nama usaha yang mudah diingat',
        'Pilih kategori yang paling relevan',
        'Tulis deskripsi yang jelas dan singkat',
        'Tambahkan foto yang bersih dan menarik',
      ]
    : [
        'Use a memorable business name',
        'Pick the most relevant category',
        'Write a clear and short description',
        'Add a clean and attractive photo',
      ];
}
