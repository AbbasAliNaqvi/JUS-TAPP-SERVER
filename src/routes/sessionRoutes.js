import express from 'express';
import * as taskController from '../controllers/taskController.js';
import * as adaptiveController from '../controllers/adaptiveController.js';

const router = express.Router();

/**
 * @route POST /api/v1/session
 * @desc Create a new assistance session
 */
router.post('/', async (req, res, next) => {
  try {
    const { userId, taskId, deviceInfo = {} } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'userId is required'
      });
    }

    const session = await taskController.createSession(
      userId,
      taskId,
      deviceInfo
    );

    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/v1/session/:sessionId
 * @desc Update session (mark complete, record progress)
 */
router.put('/:sessionId', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const updates = req.body;

    const session = await taskController.updateSession(sessionId, updates);

    res.json(session);
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/v1/session/:sessionId/event
 * @desc Record one accessibility/overlay interaction event
 */
router.post('/:sessionId/event', async (req, res, next) => {
  try {
    const result = await adaptiveController.recordInteractionEvent({
      ...req.body,
      sessionId: req.params.sessionId
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/v1/session/:sessionId/guidance
 * @desc Get adaptive next-step guidance for this session
 */
router.post('/:sessionId/guidance', async (req, res, next) => {
  try {
    const result = await adaptiveController.getAdaptiveStepGuidance({
      ...req.body,
      sessionId: req.params.sessionId
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/v1/session/:sessionId/state
 * @desc Get current adaptive session state
 */
router.get('/:sessionId/state', async (req, res, next) => {
  try {
    const result = await adaptiveController.getSessionState(req.params.sessionId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/v1/session/user/:userId
 * @desc Get user's session history
 */
router.get('/user/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;

    const sessions = await taskController.getUserSessions(
      userId,
      parseInt(limit)
    );

    res.json(sessions);
  } catch (error) {
    next(error);
  }
});

export default router;
