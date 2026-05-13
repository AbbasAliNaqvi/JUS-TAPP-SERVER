import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getFeatureImportance, getSystemAdaptiveAnalytics } from '../services/analyticsService.js';
import * as taskController from '../controllers/taskController.js';

const router = express.Router();

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

router.get('/summary', async (req, res, next) => {
  try {
    const analytics = await getSystemAdaptiveAnalytics();
    res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      analytics
    });
  } catch (error) {
    next(error);
  }
});

router.get('/simulation', async (req, res) => {
  const mode = req.query.mode === 'confused' ? 'confused' : 'independent';
  const payload = mode === 'confused'
    ? {
      repeated_taps: 5,
      inactivity_duration: 14,
      retry_count: 4,
      gesture_accuracy: 0.42,
      hesitation_time: 11,
      wrong_screen_count: 3,
      overlay_requests: 4
    }
    : {
      repeated_taps: 1,
      inactivity_duration: 2,
      retry_count: 0,
      gesture_accuracy: 0.92,
      hesitation_time: 1,
      wrong_screen_count: 0,
      overlay_requests: 0
    };

  res.json({
    success: true,
    requestId: uuidv4(),
    mode,
    payload,
    prediction: mode === 'confused'
      ? {
        prediction: 'high_assistance_needed',
        guidance_tier: 'detailed',
        confidence: 0.96
      }
      : {
        prediction: 'independent_user',
        guidance_tier: 'minimal',
        confidence: 0.92
      }
  });
});

router.get('/feature-importance', (req, res) => {
  res.json({ success: true, features: getFeatureImportance() });
});

router.post('/infer', async (req, res) => {
  await delay(420);
  const features = req.body || {};
  const confused = (features.repeated_taps || 0) >= 4 || (features.gesture_accuracy || 1) < 0.6 || (features.retry_count || 0) >= 3;
  res.json({
    success: true,
    prediction: confused ? 'high_assistance_needed' : 'independent_user',
    guidance_tier: confused ? 'detailed' : 'minimal',
    confidence: confused ? 0.96 : 0.92,
    score: confused ? 84 : 18
  });
});

router.post('/adaptive-plan', async (req, res, next) => {
  try {
    const { taskDescription, userType = 'guided', language = 'en' } = req.body || {};
    if (!taskDescription) {
      return res.status(400).json({ success: false, error: 'taskDescription is required' });
    }

    const confusionLevel = userType === 'independent'
      ? 'independent_user'
      : userType === 'assisted'
        ? 'moderate_assistance_needed'
        : 'critical_guidance_required';

    const result = await taskController.generateAdaptiveTaskPlan({
      taskDescription,
      userId: 'showcase-user',
      language,
      confusionLevel,
      userCategory: userType,
      currentScreen: 'showcase'
    });

    const steps = result?.plan?.steps || [];
    res.json({
      success: true,
      userType,
      confusionLevel,
      plan: {
        title: result?.plan?.description || taskDescription,
        appPackageName: result?.plan?.appPackageName || '',
        estimatedDuration: result?.plan?.estimatedDuration || 0,
        steps: steps.map((step, index) => ({
          stepIndex: step.stepIndex ?? index,
          instruction: step.instruction || step.targetElement || '',
          actionType: step.actionType || 'tap',
          targetElement: step.targetElement || '',
          matchText: step.matchText || step.targetElement || '',
          targetAppPackage: step.targetAppPackage || result?.plan?.appPackageName || ''
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/adaptive-plans', async (req, res, next) => {
  try {
    const { taskDescription, language = 'en' } = req.body || {};
    if (!taskDescription) {
      return res.status(400).json({ success: false, error: 'taskDescription is required' });
    }

    const modes = ['independent', 'assisted', 'guided'];
    const plans = await Promise.all(
      modes.map(async (userType) => {
        const confusionLevel = userType === 'independent'
          ? 'independent_user'
          : userType === 'assisted'
            ? 'moderate_assistance_needed'
            : 'critical_guidance_required';

        const result = await taskController.generateAdaptiveTaskPlan({
          taskDescription,
          userId: 'showcase-user',
          language,
          confusionLevel,
          userCategory: userType,
          currentScreen: 'showcase'
        });

        const steps = result?.plan?.steps || [];
        return [
          userType,
          {
            title: result?.plan?.description || taskDescription,
            appPackageName: result?.plan?.appPackageName || '',
            estimatedDuration: result?.plan?.estimatedDuration || 0,
            steps: steps.map((step, index) => ({
              stepIndex: step.stepIndex ?? index,
              instruction: step.instruction || step.targetElement || '',
              actionType: step.actionType || 'tap',
              targetElement: step.targetElement || '',
              matchText: step.matchText || step.targetElement || '',
              targetAppPackage: step.targetAppPackage || result?.plan?.appPackageName || ''
            }))
          }
        ];
      })
    );

    res.json({
      success: true,
      taskDescription,
      plans: Object.fromEntries(plans)
    });
  } catch (error) {
    next(error);
  }
});

export default router;
