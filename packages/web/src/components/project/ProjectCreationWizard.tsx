/**
 * Story C.5: Project Creation Wizard
 * Main wizard component for project creation with hidden TASTE extraction
 *
 * @see docs/specs/epic-C/story-C.5/ux-design.md
 */

'use client';

import { useState, useCallback } from 'react';
import AcrylicDialog from '@/components/os/acrylic/AcrylicDialog';
import { WorkMode, calculateProgress, PROJECT_CREATION_QUESTIONS } from '@originos/core/types';
import {
  completeProjectCreation,
  startProjectCreation,
  submitProjectCreationAnswer,
} from '@originos/core/lib/integrations/electron/services/project';

// Step components
import { StepBackground } from './wizard/StepBackground';
import { StepPriorities } from './wizard/StepPriorities';
import { StepWorkMode } from './wizard/StepWorkMode';
import { StepConfirm } from './wizard/StepConfirm';
import { CreatingState } from './wizard/CreatingState';
import { SuccessState } from './wizard/SuccessState';

// ============================================================================
// Types
// ============================================================================

export interface ProjectCreationData {
  name: string;
  background: string;
  priorities: string[];
  workMode: WorkMode | null;
  customDescriptions: {
    priorities?: string;
    workMode?: string;
  };
}

export interface ProjectCreationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (project: { id: string; name: string; path: string }) => void;
  defaultValues?: Partial<ProjectCreationData>;
}

type WizardState = 'idle' | 'creating' | 'success' | 'error';

// ============================================================================
// Component
// ============================================================================

export default function ProjectCreationWizard({
  isOpen,
  onClose,
  onComplete,
  defaultValues,
}: ProjectCreationWizardProps) {
  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [_projectId, setProjectId] = useState<string | null>(null);

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardState, setWizardState] = useState<WizardState>('idle');
  const [error, setError] = useState<string | null>(null);

  // Form data
  const [data, setData] = useState<ProjectCreationData>({
    name: defaultValues?.name ?? '',
    background: defaultValues?.background ?? '',
    priorities: defaultValues?.priorities ?? [],
    workMode: defaultValues?.workMode ?? null,
    customDescriptions: defaultValues?.customDescriptions ?? {},
  });

  // Created project
  const [createdProject, setCreatedProject] = useState<{
    id: string;
    name: string;
    path: string;
  } | null>(null);

  // Progress calculation
  const progress = calculateProgress(currentStep, 4);

  // Start session
  const startSession = useCallback(async () => {
    try {
      const result = await startProjectCreation({
        userId: 'current-user', // TODO: Get from auth context
        projectName: data.name || undefined,
        defaultValues: {
          background: data.background || undefined,
          priorities: data.priorities.length > 0 ? data.priorities : undefined,
          workMode: data.workMode || undefined,
        },
      });

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to start session');
      }

      setSessionId(result.data.sessionId);
      setProjectId(result.data.projectId);
      setCurrentStep(1);
      setWizardState('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
      setWizardState('error');
    }
  }, [data]);

  // Handle step completion
  const handleStepComplete = useCallback(async (step: number, stepData: Partial<ProjectCreationData>) => {
    // Update data
    setData(prev => ({ ...prev, ...stepData }));

    if (!sessionId) {
      await startSession();
    }

    // Submit answer to API
    if (sessionId) {
      try {
        const result = await submitProjectCreationAnswer(sessionId, {
          step,
          answer: {
            type: step === 1 ? 'text' : step === 4 ? 'confirm' : 'choice',
            value: step === 1
              ? stepData.background ?? data.background
              : step === 2
                ? stepData.priorities ?? data.priorities
                : step === 3
                  ? stepData.workMode ?? data.workMode ?? ''
                  : {},
            customDescription: step === 2
              ? stepData.customDescriptions?.priorities
              : step === 3
                ? stepData.customDescriptions?.workMode
                : undefined,
          },
        });

        if (!result.success) {
          throw new Error(result.error?.message || 'Failed to submit answer');
        }

        // Move to next step
        if (step < 4) {
          setCurrentStep(step + 1);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to submit answer');
      }
    }
  }, [sessionId, data, startSession]);

  // Handle final completion
  const handleComplete = useCallback(async () => {
    if (!sessionId) return;

    setWizardState('creating');
    setError(null);

    try {
      const result = await completeProjectCreation(sessionId, {
        projectName: data.name || 'Untitled Project',
        confirmData: {
          background: data.background,
          priorities: data.priorities,
          workMode: data.workMode ?? undefined,
        },
      });

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to create project');
      }

      setCreatedProject(result.data.project);
      setWizardState('success');

      if (onComplete) {
        onComplete(result.data.project);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      setWizardState('error');
    }
  }, [sessionId, data, onComplete]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  // Handle skip
  const handleSkip = useCallback(async () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep]);

  // Reset wizard
  const handleReset = useCallback(() => {
    setSessionId(null);
    setProjectId(null);
    setCurrentStep(1);
    setWizardState('idle');
    setError(null);
    setCreatedProject(null);
    setData({
      name: '',
      background: '',
      priorities: [],
      workMode: null,
      customDescriptions: {},
    });
  }, []);

  // Handle close with reset
  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  // Handle enter project
  const handleEnterProject = useCallback(() => {
    if (createdProject) {
      // Navigate to project page
      window.location.href = createdProject.path;
    }
    handleClose();
  }, [createdProject, handleClose]);

  // Get current question
  const currentQuestion = PROJECT_CREATION_QUESTIONS.find(q => q.step === currentStep);

  // Render step content
  const renderStepContent = () => {
    if (wizardState === 'creating') {
      return <CreatingState />;
    }

    if (wizardState === 'success' && createdProject) {
      return (
        <SuccessState
          project={createdProject}
          onEnter={handleEnterProject}
          onLater={handleClose}
        />
      );
    }

    switch (currentStep) {
      case 1:
        return (
          <StepBackground
            value={data.background}
            onChange={(value) => setData(prev => ({ ...prev, background: value }))}
            onNext={() => handleStepComplete(1, { background: data.background })}
            onSkip={handleSkip}
            question={currentQuestion}
          />
        );

      case 2:
        return (
          <StepPriorities
            selected={data.priorities}
            customValue={data.customDescriptions.priorities}
            onChange={(selected, custom) =>
              setData(prev => ({
                ...prev,
                priorities: selected,
                customDescriptions: { ...prev.customDescriptions, priorities: custom },
              }))
            }
            onNext={() => handleStepComplete(2, { priorities: data.priorities })}
            onBack={handleBack}
            onSkip={handleSkip}
            question={currentQuestion}
          />
        );

      case 3:
        return (
          <StepWorkMode
            value={data.workMode}
            customValue={data.customDescriptions.workMode}
            onChange={(value, custom) =>
              setData(prev => ({
                ...prev,
                workMode: value,
                customDescriptions: { ...prev.customDescriptions, workMode: custom },
              }))
            }
            onNext={() => handleStepComplete(3, { workMode: data.workMode })}
            onBack={handleBack}
            onSkip={handleSkip}
            question={currentQuestion}
          />
        );

      case 4:
        return (
          <StepConfirm
            data={data}
            projectName={data.name}
            onProjectNameChange={(name) => setData(prev => ({ ...prev, name }))}
            onConfirm={handleComplete}
            onBack={handleBack}
            onEdit={(step) => setCurrentStep(step)}
            isLoading={wizardState === ('creating' as any)}
            error={error}
          />
        );

      default:
        return null;
    }
  };

  // Render progress bar
  const renderProgressBar = () => {
    if (wizardState === 'creating' || wizardState === 'success') {
      return null;
    }

    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            步骤 {currentStep} / 4
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {progress}%
          </span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <AcrylicDialog
      isOpen={isOpen}
      onClose={handleClose}
      title={wizardState === 'success' ? '项目创建成功' : '项目创建访谈'}
      size="lg"
      variant="standard"
    >
      <div className="min-h-[400px]">
        {renderProgressBar()}
        {renderStepContent()}
      </div>
    </AcrylicDialog>
  );
}
