import express from 'express';
import * as adaptiveController from '../controllers/adaptiveController.js';

const router = express.Router();

router.post('/event', async (req, res, next) => {
  try {
    const { sessionId, userId, eventType } = req.body;
    if (!sessionId || !userId || !eventType) {
      return res.status(400).json({ error: 'sessionId, userId, and eventType are required' });
    }

    const result = await adaptiveController.recordInteractionEvent(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/events/batch', async (req, res, next) => {
  try {
    if (!Array.isArray(req.body.events)) {
      return res.status(400).json({ error: 'events array is required' });
    }

    const result = await adaptiveController.recordBatchEvents(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/predict', async (req, res, next) => {
  try {
    const { sessionId, userId, features } = req.body;
    if (!sessionId && !userId && !features) {
      return res.status(400).json({ error: 'sessionId, userId, or features are required' });
    }
    if (features && !sessionId && !userId) {
      return res.status(400).json({ error: 'userId is required when predicting directly from features' });
    }

    const result = await adaptiveController.getConfusionPrediction(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/features', async (req, res, next) => {
  try {
    const result = await adaptiveController.getFeatureSnapshot(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/guidance', async (req, res, next) => {
  try {
    const { sessionId, taskId } = req.body;
    if (!sessionId && !taskId) {
      return res.status(400).json({ error: 'sessionId or taskId is required' });
    }

    const result = await adaptiveController.getAdaptiveStepGuidance(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/session/:sessionId/state', async (req, res, next) => {
  try {
    const result = await adaptiveController.getSessionState(req.params.sessionId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/prompt-context', async (req, res, next) => {
  try {
    const result = adaptiveController.getPromptContext(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
