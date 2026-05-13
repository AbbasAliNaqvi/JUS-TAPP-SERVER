import {
  logInteractionEvent,
  predictConfusion,
  extractFeatures
} from '../services/confusionDetectionService.js';
import { getAdaptiveGuidance, buildAdaptivePromptContext } from '../services/adaptiveGuidanceService.js';
import { Session } from '../models/Task.js';
import { ConfusionPrediction, GuidanceVersion, InteractionEvent } from '../models/AdaptiveIntelligence.js';
import { buildSessionLookup, notFoundError } from '../utils/idLookup.js';

export const recordInteractionEvent = async (payload) => {
  const event = await logInteractionEvent(payload);

  return {
    success: true,
    eventId: event._id.toString(),
    sessionId: event.sessionPublicId,
    taskId: event.taskPublicId,
    eventType: event.eventType,
    createdAt: event.createdAt
  };
};

export const recordBatchEvents = async ({ events = [] }) => {
  const saved = [];
  for (const event of events) {
    saved.push(await logInteractionEvent(event));
  }

  return {
    success: true,
    count: saved.length,
    eventIds: saved.map(event => event._id.toString())
  };
};

export const getConfusionPrediction = async (payload) => {
  const prediction = await predictConfusion(payload);
  return {
    success: true,
    prediction
  };
};

export const getFeatureSnapshot = async (payload) => {
  const result = await extractFeatures(payload);
  return {
    success: true,
    ...result
  };
};

export const getAdaptiveStepGuidance = async (payload) => {
  const guidance = await getAdaptiveGuidance(payload);
  return {
    success: true,
    guidance
  };
};

export const getSessionState = async (sessionId) => {
  const session = await Session.findOne(buildSessionLookup(sessionId)).populate('taskId');
  if (!session) throw notFoundError('Session');

  const latestPrediction = await ConfusionPrediction.findOne({
    sessionPublicId: session.publicId || sessionId
  }).sort({ createdAt: -1 });

  const latestGuidance = await GuidanceVersion.findOne({
    sessionPublicId: session.publicId || sessionId
  }).sort({ createdAt: -1 });

  const recentEvents = await InteractionEvent.find({
    sessionPublicId: session.publicId || sessionId
  }).sort({ createdAt: -1 }).limit(10);

  return {
    success: true,
    session: {
      sessionId: session.publicId || session._id.toString(),
      mongoId: session._id.toString(),
      userId: session.userId,
      taskId: session.taskId?.publicId || session.taskId?._id?.toString() || session.taskId?.toString(),
      status: session.status,
      currentStepIndex: session.currentStepIndex,
      confusionLevel: session.confusionLevel,
      confusionScore: session.confusionScore,
      guidanceTier: session.guidanceTier,
      progress: session.progress,
      updatedAt: session.updatedAt
    },
    latestPrediction,
    latestGuidance,
    recentEvents
  };
};

export const getPromptContext = (payload) => ({
  success: true,
  prompt: buildAdaptivePromptContext(payload)
});
