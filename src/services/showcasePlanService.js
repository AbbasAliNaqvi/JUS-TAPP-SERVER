import TaskPlanService from './taskPlanService.js';

const userModeConfig = {
  independent: {
    confusionLevel: 'independent_user',
    userCategory: 'independent',
    detailLabel: 'Concise',
    durationMultiplier: 0.9
  },
  assisted: {
    confusionLevel: 'moderate_assistance_needed',
    userCategory: 'assisted',
    detailLabel: 'Balanced',
    durationMultiplier: 1.15
  },
  guided: {
    confusionLevel: 'critical_guidance_required',
    userCategory: 'guided',
    detailLabel: 'Highly detailed',
    durationMultiplier: 1.55
  }
};

const shapeStepForMode = (step, mode) => {
  const baseTarget = (step.targetElement || step.matchText || '').toString().trim();
  const instruction = (step.instruction || '').toString().trim();

  if (mode === 'independent') {
    return {
      ...step,
      instruction: instruction.length > 60 ? instruction.split('.')[0] : instruction,
      targetElement: baseTarget || step.targetElement,
      matchText: baseTarget || step.matchText
    };
  }

  if (mode === 'assisted') {
    return {
      ...step,
      instruction: instruction.endsWith('.') ? instruction : `${instruction}.`,
      targetElement: baseTarget || step.targetElement,
      matchText: baseTarget || step.matchText
    };
  }

  return {
    ...step,
    instruction: `Go slowly. ${instruction.replace(/\.$/, '')}. Tap only the exact label "${baseTarget || step.matchText || step.targetElement}".`,
    targetElement: baseTarget || step.targetElement,
    matchText: baseTarget || step.matchText || step.targetElement
  };
};

const shapePlanForMode = (plan, mode) => {
  const sourcePlan = plan?.plan || plan || {};
  const config = userModeConfig[mode] || userModeConfig.guided;
  const steps = (sourcePlan.steps || []).map((step, index) => ({
    ...shapeStepForMode({ ...step, stepIndex: step.stepIndex ?? index }, mode),
    targetAppPackage: step.targetAppPackage || sourcePlan.appPackageName || ''
  }));

  return {
    title: sourcePlan.description || '',
    appPackageName: sourcePlan.appPackageName || '',
    estimatedDuration: Math.max(
      30,
      Math.round((sourcePlan.estimatedDuration || 60) * config.durationMultiplier)
    ),
    detailLabel: config.detailLabel,
    steps
  };
};

export const generateShowcasePlan = async ({ taskDescription, userType = 'guided', language = 'en' }) => {
  const config = userModeConfig[userType] || userModeConfig.guided;
  const result = await TaskPlanService.generateAdaptiveTaskPlan(taskDescription, 'showcase-user', {
    language,
    confusionLevel: config.confusionLevel,
    userCategory: config.userCategory,
    currentScreen: 'showcase'
  });

  return shapePlanForMode(result, userType);
};

export const generateShowcasePlans = async ({ taskDescription, language = 'en' }) => {
  const modes = ['independent', 'assisted', 'guided'];
  const entries = await Promise.all(
    modes.map(async (mode) => [mode, await generateShowcasePlan({ taskDescription, userType: mode, language })])
  );
  return Object.fromEntries(entries);
};
