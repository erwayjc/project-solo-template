"use client";

import { useState } from "react";

const steps = [
  { id: "account", title: "Create Your Account" },
  { id: "database", title: "Database Connection" },
  { id: "payments", title: "Payments" },
  { id: "email", title: "Email" },
  { id: "ai", title: "AI Connection" },
  { id: "social", title: "Social Publishing" },
  { id: "branding", title: "Brand Your Business" },
  { id: "context", title: "Clone Your Brain" },
  { id: "launch", title: "Launch" },
];

export default function SetupWizardPage() {
  const [currentStep, setCurrentStep] = useState(0);

  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="text-2xl font-bold text-gray-900">Setup Wizard</h1>
      <p className="mt-2 text-gray-600">
        Let&apos;s get your business set up. This takes about 30-60 minutes.
      </p>

      {/* Step indicators */}
      <div className="mt-8 flex gap-1">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`h-2 flex-1 rounded-full ${
              index <= currentStep ? "bg-blue-600" : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      {/* Current step */}
      <div className="mt-8 rounded-lg border bg-white p-8">
        <h2 className="text-xl font-semibold text-gray-900">
          Step {currentStep + 1}: {steps[currentStep].title}
        </h2>
        <p className="mt-2 text-gray-600">
          {/* Step content will be rendered here based on currentStep */}
          Setup step content goes here.
        </p>
      </div>

      {/* Navigation */}
      <div className="mt-6 flex justify-between">
        <button
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={() =>
            setCurrentStep(Math.min(steps.length - 1, currentStep + 1))
          }
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {currentStep === steps.length - 1 ? "Launch!" : "Continue"}
        </button>
      </div>
    </div>
  );
}
