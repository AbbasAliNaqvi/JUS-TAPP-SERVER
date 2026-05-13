import express from 'express';
import * as adaptiveController from '../controllers/adaptiveController.js';

const router = express.Router();

router.post('/adapt', async (req, res, next) => {
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

export default router;
