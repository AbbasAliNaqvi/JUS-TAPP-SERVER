import { v4 as uuidv4 } from 'uuid';
import { Task, Session } from '../models/Task.js';
import { GuidanceVersion } from '../models/AdaptiveIntelligence.js';
import { buildSessionLookup, buildTaskLookup, notFoundError } from '../utils/idLookup.js';
import { guidanceTierForLevel, predictConfusion } from './confusionDetectionService.js';

const overlayModeForTier = (tier) => {
  if (tier === 'critical') return 'voice_visual_slow';
  if (tier === 'detailed') return 'enhanced_visual';
  if (tier === 'standard') return 'guided';
  return 'minimal';
};

const detailPrefix = {
  minimal: '',
  standard: 'Please ',
  detailed: 'Look carefully at the screen. ',
  critical: 'Go slowly. First look at the screen, then '
};

const actionPhrase = (step = {}) => {
  const target = step.matchText || step.targetElement || 'the highlighted option';
  const instruction = step.instruction || 'continue';

  if (step.actionType === 'openApp') return `open ${target}`;
  if (step.actionType === 'input') return `type in the field labeled "${target}"`;
  if (step.actionType === 'scroll') return `scroll until you can see "${target}"`;
  if (step.actionType === 'swipe') return `swipe on the area related to "${target}"`;
  if (step.actionType === 'wait') return `wait until "${target}" appears`;
  return instruction.toLowerCase().includes(target.toLowerCase())
    ? instruction
    : `tap "${target}"`;
};

const adaptInstruction = (step, tier) => {
  const target = step.matchText || step.targetElement || 'the highlighted item';
  const phrase = actionPhrase(step);

  if (tier === 'critical') {
    return `${detailPrefix[tier]}tap only the highlighted item labeled "${target}". Wait for the screen to change before doing anything else.`;
  }

  if (tier === 'detailed') {
    return `${detailPrefix[tier]}${phrase}. Use the visible text or icon labeled "${target}" as your target.`;
  }

  if (tier === 'standard') {
    return `${detailPrefix[tier]}${phrase}.`;
  }

  return step.instruction || phrase;
};

const buildVoiceHint = (step, tier) => {
  if (tier === 'minimal') return '';
  const target = step.matchText || step.targetElement || 'the highlighted item';
  if (tier === 'critical') return `Slowly tap ${target}. Stop after the tap and wait.`;
  return `Tap ${target}.`;
};

const buildAdaptedStep = (step, tier, prediction) => ({
  stepIndex: step?.stepIndex ?? 0,
  instruction: adaptInstruction(step, tier),
  shortInstruction: step?.instruction || '',
  actionType: step?.actionType || 'tap',
  targetElement: step?.targetElement || '',
  matchText: step?.matchText || step?.targetElement || '',
  targetAppPackage: step?.targetAppPackage || '',
  highlightText: step?.matchText || step?.targetElement || '',
  voiceHint: buildVoiceHint(step, tier),
  detailLevel: tier,
  confusionLevel: prediction.level,
  confidence: prediction.confidence,
  visualHints: {
    emphasizeTarget: tier !== 'minimal',
    pulseTarget: tier === 'detailed' || tier === 'critical',
    dimBackground: tier === 'critical',
    slowMode: tier === 'critical'
  }
});

export const getAdaptiveGuidance = async ({
  sessionId,
  taskId,
  userId,
  stepIndex,
  forceConfusionLevel,
  features
}) => {
  const session = sessionId ? await Session.findOne(buildSessionLookup(sessionId)) : null;
  if (sessionId && !session) throw notFoundError('Session');

  const task = taskId
    ? await Task.findOne(buildTaskLookup(taskId))
    : session?.taskId
      ? await Task.findById(session.taskId)
      : null;
  if (!task) throw notFoundError('Task');

  const activeStepIndex = Number(stepIndex ?? session?.currentStepIndex ?? task.currentStepIndex ?? 0);
  const step = task.steps.find(item => item.stepIndex === activeStepIndex) || task.steps[activeStepIndex] || null;
  if (!step) throw notFoundError('Task step');

  const prediction = forceConfusionLevel
    ? {
      level: forceConfusionLevel,
      score: forceConfusionLevel === 'critical_guidance_required' ? 90 : 60,
      confidence: 0.99,
      guidanceTier: guidanceTierForLevel(forceConfusionLevel),
      features: features || {},
      reasons: ['Forced by API request']
    }
    : await predictConfusion({
      sessionId: session?.publicId || sessionId,
      taskId: task.publicId || task._id.toString(),
      userId: userId || task.userId,
      stepIndex: activeStepIndex,
      features
    });

  const tier = prediction.guidanceTier || guidanceTierForLevel(prediction.level);
  const adaptedStep = buildAdaptedStep(step, tier, prediction);
  const overlayMode = overlayModeForTier(tier);

  const version = await GuidanceVersion.create({
    publicId: `guidance_${uuidv4().split('-')[0]}`,
    sessionId: session?._id,
    sessionPublicId: session?.publicId || sessionId,
    taskId: task._id,
    taskPublicId: task.publicId,
    userId: userId || task.userId,
    stepIndex: activeStepIndex,
    confusionLevel: prediction.level,
    guidanceTier: tier,
    overlayMode,
    originalStep: step.toObject ? step.toObject() : step,
    adaptedStep,
    promptContext: {
      reasons: prediction.reasons,
      featureSnapshot: prediction.features
    }
  });

  if (session) {
    session.currentStepIndex = activeStepIndex;
    session.confusionLevel = prediction.level;
    session.confusionScore = prediction.score;
    session.guidanceTier = tier;
    await session.save();
  }

  return {
    guidanceId: version.publicId,
    taskId: task.publicId || task._id.toString(),
    mongoTaskId: task._id.toString(),
    sessionId: session?.publicId || sessionId,
    stepIndex: activeStepIndex,
    confusionLevel: prediction.level,
    confidence: prediction.confidence,
    score: prediction.score,
    guidanceTier: tier,
    overlayMode,
    reasons: prediction.reasons,
    step: adaptedStep
  };
};

export const buildAdaptivePromptContext = ({ taskDescription, confusionLevel, userProfile = {}, currentScreen = '' }) => {
  const tier = guidanceTierForLevel(confusionLevel);
  return {
    systemPrompt: [
      'You are JUS TAPP adaptive accessibility intelligence.',
      'Generate smartphone task guidance for an Android overlay assistant.',
      'Use elderly-friendly language and exact visible target text.',
      `Guidance tier: ${tier}.`,
      `Confusion level: ${confusionLevel}.`
    ].join(' '),
    userPrompt: [
      `Task: ${taskDescription}`,
      `Current screen: ${currentScreen || 'unknown'}`,
      `User preferences: ${JSON.stringify(userProfile)}`,
      'Return JSON steps with instruction, actionType, targetElement, matchText, highlightText, and voiceHint.'
    ].join('\n')
  };
};
