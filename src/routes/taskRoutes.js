import express from 'express';
import * as taskController from '../controllers/taskController.js';

const router = express.Router();

/**
 * @route POST /api/v1/task/plan
 * @desc Generate task plan from natural language description
 * @body { taskDescription, userId, language }
 */
router.post('/plan', async (req, res, next) => {
  try {
    const { taskDescription, userId, language = 'en' } = req.body;

    if (!taskDescription || !userId) {
      return res.status(400).json({
        error: 'taskDescription and userId are required'
      });
    }

    const result = await taskController.generateTaskPlan(
      taskDescription,
      userId,
      language
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/plan/adaptive', async (req, res, next) => {
  try {
    const { taskDescription, userId } = req.body;

    if (!taskDescription || !userId) {
      return res.status(400).json({
        error: 'taskDescription and userId are required'
      });
    }

    const result = await taskController.generateAdaptiveTaskPlan(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/v1/task/user/:userId
 * @desc Get user's task history
 */
router.get('/user/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { limit = 20, skip = 0 } = req.query;

    const result = await taskController.getUserTasks(
      userId,
      parseInt(limit),
      parseInt(skip)
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/v1/task/:taskId/master
 * @desc Get next step + highlight text for task execution
 */
router.get('/:taskId/master', async (req, res, next) => {
  try {
    const result = await taskController.getMasterStep(req.params.taskId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/v1/task/:taskId
 * @desc Get task details
 */
router.get('/:taskId', async (req, res, next) => {
  try {
    const task = await taskController.getTask(req.params.taskId);
    res.json(task);
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/v1/task/:taskId/step/:stepIndex
 * @desc Update task step status
 */
router.put('/:taskId/step/:stepIndex', async (req, res, next) => {
  try {
    const { taskId, stepIndex } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        error: 'status is required'
      });
    }

    const task = await taskController.updateTaskStep(
      taskId,
      parseInt(stepIndex),
      status
    );

    res.json(task);
  } catch (error) {
    next(error);
  }
});

export default router;
