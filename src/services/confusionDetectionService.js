import { InteractionEvent, ConfusionPrediction, UserIntelligenceProfile } from '../models/AdaptiveIntelligence.js';
import { Task, Session } from '../models/Task.js';
import { buildSessionLookup, buildTaskLookup, notFoundError } from '../utils/idLookup.js';

const LEVELS = [
  'independent_user',
  'moderate_assistance_needed',
  'high_assistance_needed',
  'critical_guidance_required'
];

const EVENT_TO_FEATURE = {
  tap: 'totalTapCount',
  incorrect_tap: 'incorrectTaps',
  repeated_tap: 'repeatedTaps',
  back: 'backButtonCount',
  navigation_retry: 'navigationRetries',
  overlay_request: 'overlayRequestCount',
  hesitation: 'hesitationMs',
  inactivity: 'inactivityMs',
  wrong_screen: 'wrongScreenCount',
  same_screen_loop: 'sameScreenLoopCount',
  voice_help: 'voiceHelpCount'
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const createDefaultFeatures = () => ({
  repeatedTaps: 0,
  incorrectTaps: 0,
  inactivityMs: 0,
  navigationRetries: 0,
  backButtonCount: 0,
  gestureAccuracy: 1,
  taskCompletionMs: 0,
  overlayRequestCount: 0,
  hesitationMs: 0,
  wrongScreenCount: 0,
  sameScreenLoopCount: 0,
  stepDurationMs: 0,
  totalTapCount: 0,
  voiceHelpCount: 0
});

export const logInteractionEvent = async ({
  sessionId,
  taskId,
  userId,
  stepIndex = 0,
  eventType,
  value = 1,
  durationMs = 0,
  screenName,
  targetText,
  targetElement,
  expectedElement,
  metadata = {},
  clientTimestamp
}) => {
  const session = sessionId ? await Session.findOne(buildSessionLookup(sessionId)) : null;
  if (sessionId && !session) throw notFoundError('Session');

  const task = taskId
    ? await Task.findOne(buildTaskLookup(taskId))
    : session?.taskId
      ? await Task.findById(session.taskId)
      : null;
  if (taskId && !task) throw notFoundError('Task');

  const event = await InteractionEvent.create({
    sessionId: session?._id,
    sessionPublicId: session?.publicId || sessionId,
    taskId: task?._id,
    taskPublicId: task?.publicId || taskId,
    userId: userId || session?.userId,
    stepIndex,
    eventType,
    value,
    durationMs,
    screenName,
    targetText,
    targetElement,
    expectedElement,
    metadata,
    clientTimestamp: clientTimestamp ? new Date(clientTimestamp) : undefined
  });

  await UserIntelligenceProfile.findOneAndUpdate(
    { userId: event.userId },
    { $inc: { totalEvents: 1 }, $setOnInsert: { userId: event.userId } },
    { upsert: true, new: true }
  );

  return event;
};

export const extractFeatures = async ({ sessionId, taskId, userId, stepIndex, windowMinutes = 10 }) => {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  const query = {
    createdAt: { $gte: since }
  };

  if (sessionId) query.$or = [{ sessionPublicId: sessionId }];
  if (userId) query.userId = userId;
  if (taskId) query.taskPublicId = taskId;
  if (stepIndex !== undefined && stepIndex !== null) query.stepIndex = Number(stepIndex);

  const events = await InteractionEvent.find(query)
    .sort({ createdAt: -1 })
    .limit(250);

  const features = createDefaultFeatures();
  const gestureScores = [];
  let firstEventAt = null;
  let lastEventAt = null;

  for (const event of events) {
    firstEventAt = firstEventAt ? firstEventAt : event.createdAt;
    lastEventAt = event.createdAt;
    const featureName = EVENT_TO_FEATURE[event.eventType];
    if (featureName) {
      const amount = ['hesitationMs', 'inactivityMs'].includes(featureName)
        ? event.durationMs || event.value || 0
        : event.value || 1;
      features[featureName] += amount;
    }
    if (event.eventType === 'gesture') {
      gestureScores.push(clamp(event.value, 0, 1));
    }
    if (event.eventType === 'step_started') firstEventAt = event.createdAt;
    if (event.eventType === 'step_completed') lastEventAt = event.createdAt;
  }

  if (gestureScores.length) {
    features.gestureAccuracy = gestureScores.reduce((sum, score) => sum + score, 0) / gestureScores.length;
  }

  if (firstEventAt && lastEventAt) {
    features.stepDurationMs = Math.abs(firstEventAt.getTime() - lastEventAt.getTime());
  }

  return { features, eventCount: events.length };
};

export const predictFromFeatures = (features = createDefaultFeatures()) => {
  const reasons = [];
  let score = 0;

  const add = (condition, points, reason) => {
    if (condition) {
      score += points;
      reasons.push(reason);
    }
  };

  add(features.repeatedTaps >= 2, Math.min(features.repeatedTaps * 6, 18), 'Repeated taps detected');
  add(features.incorrectTaps >= 1, Math.min(features.incorrectTaps * 10, 25), 'Incorrect taps detected');
  add(features.inactivityMs >= 5000, Math.min(features.inactivityMs / 1000, 20), 'Long inactivity or hesitation');
  add(features.hesitationMs >= 3000, Math.min(features.hesitationMs / 1200, 15), 'User hesitated before acting');
  add(features.navigationRetries >= 1, Math.min(features.navigationRetries * 9, 20), 'Navigation retries detected');
  add(features.backButtonCount >= 2, Math.min(features.backButtonCount * 7, 18), 'Frequent back navigation');
  add(features.overlayRequestCount >= 2, Math.min(features.overlayRequestCount * 6, 18), 'Frequent overlay help requests');
  add(features.wrongScreenCount >= 1, Math.min(features.wrongScreenCount * 12, 24), 'Wrong screen navigation');
  add(features.sameScreenLoopCount >= 2, Math.min(features.sameScreenLoopCount * 8, 18), 'Repeated same-screen loop');
  add(features.gestureAccuracy < 0.7, Math.round((0.7 - features.gestureAccuracy) * 45), 'Low gesture accuracy');
  add(features.stepDurationMs >= 20000, Math.min(features.stepDurationMs / 2000, 16), 'Step is taking longer than expected');
  add(features.voiceHelpCount >= 1, Math.min(features.voiceHelpCount * 7, 15), 'Voice help requested');

  const normalizedScore = clamp(Math.round(score), 0, 100);
  let level = LEVELS[0];
  if (normalizedScore >= 75) level = LEVELS[3];
  else if (normalizedScore >= 50) level = LEVELS[2];
  else if (normalizedScore >= 25) level = LEVELS[1];

  return {
    level,
    score: normalizedScore,
    confidence: clamp(0.62 + Math.abs(normalizedScore - 50) / 125, 0.62, 0.96),
    reasons
  };
};

export const predictConfusion = async ({ sessionId, taskId, userId, stepIndex, features }) => {
  const session = sessionId ? await Session.findOne(buildSessionLookup(sessionId)) : null;
  if (sessionId && !session) throw notFoundError('Session');

  const task = taskId
    ? await Task.findOne(buildTaskLookup(taskId))
    : session?.taskId
      ? await Task.findById(session.taskId)
      : null;
  if (taskId && !task) throw notFoundError('Task');

  const featureResult = features
    ? { features, eventCount: 0 }
    : await extractFeatures({
      sessionId: session?.publicId || sessionId,
      taskId: task?.publicId || taskId,
      userId: userId || session?.userId,
      stepIndex
    });

  const prediction = predictFromFeatures({
    ...createDefaultFeatures(),
    ...featureResult.features
  });

  const saved = await ConfusionPrediction.create({
    sessionId: session?._id,
    sessionPublicId: session?.publicId || sessionId,
    taskId: task?._id,
    taskPublicId: task?.publicId || taskId,
    userId: userId || session?.userId,
    stepIndex: Number(stepIndex || session?.currentStepIndex || 0),
    level: prediction.level,
    score: prediction.score,
    confidence: prediction.confidence,
    features: featureResult.features,
    reasons: prediction.reasons
  });

  if (session) {
    session.confusionLevel = prediction.level;
    session.confusionScore = prediction.score;
    session.guidanceTier = guidanceTierForLevel(prediction.level);
    await session.save();
  }

  await UserIntelligenceProfile.findOneAndUpdate(
    { userId: userId || session?.userId },
    {
      $set: {
        lastPredictionLevel: prediction.level,
        baselineConfusionScore: prediction.score
      },
      $setOnInsert: { userId: userId || session?.userId }
    },
    { upsert: true }
  );

  return {
    predictionId: saved._id.toString(),
    level: prediction.level,
    score: prediction.score,
    confidence: prediction.confidence,
    guidanceTier: guidanceTierForLevel(prediction.level),
    features: featureResult.features,
    reasons: prediction.reasons
  };
};

export const guidanceTierForLevel = (level) => {
  if (level === 'critical_guidance_required') return 'critical';
  if (level === 'high_assistance_needed') return 'detailed';
  if (level === 'moderate_assistance_needed') return 'standard';
  return 'minimal';
};
