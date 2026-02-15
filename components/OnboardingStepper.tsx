"use client";

type OnboardingStepperProps = {
  currentStep: number;
};

const STEPS = ["Sign In", "KYC", "Fraud Check", "Green Score", "Dashboard"];

export default function OnboardingStepper({ currentStep }: OnboardingStepperProps) {
  return (
    <div className="stepper-wrap">
      <ol className="stepper">
        {STEPS.map((label, index) => {
          const step = index + 1;
          const state = step < currentStep ? "done" : step === currentStep ? "active" : "";
          return (
            <li key={label} className={`step-node ${state}`.trim()}>
              <span className="step-dot">{step}</span>
              <span className="step-label">{label}</span>
              {step < STEPS.length ? <span className={`step-line ${step < currentStep ? "done" : ""}`.trim()} /> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
