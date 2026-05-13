import {
  getFeatureImportance,
  getSystemAdaptiveAnalytics,
  getUserAdaptiveAnalytics
} from '../services/analyticsService.js';

export const userAnalytics = async (userId) => ({
  success: true,
  analytics: await getUserAdaptiveAnalytics(userId)
});

export const systemAnalytics = async () => ({
  success: true,
  analytics: await getSystemAdaptiveAnalytics()
});

export const featureImportance = () => ({
  success: true,
  featureImportance: getFeatureImportance()
});
