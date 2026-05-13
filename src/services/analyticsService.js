import { Task, Session } from '../models/Task.js';
import {
  ConfusionPrediction,
  GuidanceVersion,
  InteractionEvent,
  UserIntelligenceProfile
} from '../models/AdaptiveIntelligence.js';

const levelOrder = [
  'independent_user',
  'moderate_assistance_needed',
  'high_assistance_needed',
  'critical_guidance_required'
];

const featureWeights = {
  repeatedTaps: 18,
  incorrectTaps: 25,
  inactivityMs: 20,
  navigationRetries: 20,
  backButtonCount: 18,
  gestureAccuracy: 20,
  overlayRequestCount: 18,
  hesitationMs: 15,
  wrongScreenCount: 24,
  sameScreenLoopCount: 18,
  stepDurationMs: 16,
  voiceHelpCount: 15
};

const groupCount = (items, field) => items.reduce((acc, item) => {
  const key = item[field] || 'unknown';
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});

const average = (values) => {
  const filtered = values.filter(value => typeof value === 'number' && !Number.isNaN(value));
  if (!filtered.length) return 0;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
};

export const getUserAdaptiveAnalytics = async (userId) => {
  const [tasks, sessions, predictions, guidanceVersions, events, profile] = await Promise.all([
    Task.find({ userId }).sort({ createdAt: -1 }).limit(100),
    Session.find({ userId }).sort({ createdAt: -1 }).limit(100),
    ConfusionPrediction.find({ userId }).sort({ createdAt: -1 }).limit(500),
    GuidanceVersion.find({ userId }).sort({ createdAt: -1 }).limit(500),
    InteractionEvent.find({ userId }).sort({ createdAt: -1 }).limit(1000),
    UserIntelligenceProfile.findOne({ userId })
  ]);

  const assistanceDistribution = levelOrder.reduce((acc, level) => {
    acc[level] = predictions.filter(prediction => prediction.level === level).length;
    return acc;
  }, {});

  const firstScores = predictions.slice(-20).map(prediction => prediction.score);
  const latestScores = predictions.slice(0, 20).map(prediction => prediction.score);
  const baselineConfusion = average(firstScores);
  const latestConfusion = average(latestScores);
  const taskCompletionDurations = tasks
    .filter(task => task.completedAt && task.createdAt)
    .map(task => task.completedAt.getTime() - task.createdAt.getTime());

  return {
    userId,
    profile,
    totals: {
      tasks: tasks.length,
      sessions: sessions.length,
      events: events.length,
      predictions: predictions.length,
      guidanceVersions: guidanceVersions.length
    },
    assistanceDistribution,
    eventDistribution: groupCount(events, 'eventType'),
    guidanceTierDistribution: groupCount(guidanceVersions, 'guidanceTier'),
    taskCompletion: {
      completedTasks: tasks.filter(task => task.status === 'completed').length,
      averageCompletionMs: Math.round(average(taskCompletionDurations)),
      averageProgress: Math.round(average(sessions.map(session => session.progress || 0)))
    },
    learningSignal: {
      baselineConfusion: Math.round(baselineConfusion),
      latestConfusion: Math.round(latestConfusion),
      confusionDelta: Math.round(latestConfusion - baselineConfusion),
      adaptationActive: guidanceVersions.length > 0
    },
    latestPrediction: predictions[0] || null,
    latestGuidance: guidanceVersions[0] || null
  };
};

export const getSystemAdaptiveAnalytics = async () => {
  const [sessions, predictions, guidanceVersions, events] = await Promise.all([
    Session.find({}).sort({ createdAt: -1 }).limit(500),
    ConfusionPrediction.find({}).sort({ createdAt: -1 }).limit(1000),
    GuidanceVersion.find({}).sort({ createdAt: -1 }).limit(1000),
    InteractionEvent.find({}).sort({ createdAt: -1 }).limit(2000)
  ]);

  return {
    totals: {
      sessions: sessions.length,
      predictions: predictions.length,
      guidanceVersions: guidanceVersions.length,
      events: events.length
    },
    assistanceDistribution: levelOrder.reduce((acc, level) => {
      acc[level] = predictions.filter(prediction => prediction.level === level).length;
      return acc;
    }, {}),
    eventDistribution: groupCount(events, 'eventType'),
    guidanceTierDistribution: groupCount(guidanceVersions, 'guidanceTier'),
    averageConfusionScore: Math.round(average(predictions.map(prediction => prediction.score))),
    activeSessions: sessions.filter(session => session.status === 'active').length,
    featureImportance: Object.entries(featureWeights)
      .map(([feature, importance]) => ({ feature, importance }))
      .sort((a, b) => b.importance - a.importance)
  };
};

export const getFeatureImportance = () => Object.entries(featureWeights)
  .map(([feature, importance]) => ({
    feature,
    importance,
    normalizedImportance: Number((importance / Math.max(...Object.values(featureWeights))).toFixed(3))
  }))
  .sort((a, b) => b.importance - a.importance);
