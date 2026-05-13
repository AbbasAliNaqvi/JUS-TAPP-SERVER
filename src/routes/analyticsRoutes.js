import express from 'express';
import * as analyticsController from '../controllers/analyticsController.js';

const router = express.Router();

router.get('/user/:userId', async (req, res, next) => {
  try {
    const result = await analyticsController.userAnalytics(req.params.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/system', async (req, res, next) => {
  try {
    const result = await analyticsController.systemAnalytics();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/feature-importance', async (req, res, next) => {
  try {
    const result = analyticsController.featureImportance();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
