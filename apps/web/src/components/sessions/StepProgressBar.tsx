import type { StepCompletion } from '@/types/session';

interface StepProgressBarProps {
  steps: StepCompletion;
}

const STEP_LABELS = [
  { key: 'step1_diagnosis', label: '1. Diagnosa' },
  { key: 'step2_therapyPlan', label: '2. Terapi Plan' },
  { key: 'step3_vitalBefore', label: '3. Vital Sebelum' },
  { key: 'step4_infusion', label: '4. Infus Aktual' },
  { key: 'step5_materials', label: '5. Bahan Tambahan' },
  { key: 'step6_photo', label: '6. Foto Sesi' },
  { key: 'step7_vitalAfter', label: '7. Vital Sesudah' },
  { key: 'step8_evaluation', label: '8. Evaluasi SOAP' },
];

export default function StepProgressBar({ steps }: StepProgressBarProps) {
  const completedCount = Object.values(steps).filter(Boolean).length;
  const totalSteps = STEP_LABELS.length;
  const progressPercentage = (completedCount / totalSteps) * 100;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Progress Pendataan</h2>
        <span className="text-sm text-gray-600">
          {completedCount} / {totalSteps} step selesai
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* Step Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {STEP_LABELS.map((step) => {
          const isCompleted = steps[step.key as keyof StepCompletion];
          return (
            <div
              key={step.key}
              className={`
                px-3 py-2 rounded-lg text-sm font-medium text-center transition-colors
                ${
                  isCompleted
                    ? 'bg-green-100 text-green-800 border border-green-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-300'
                }
              `}
            >
              <div className="flex items-center justify-center gap-2">
                {isCompleted && (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                <span>{step.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
