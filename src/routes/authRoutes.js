import express from 'express';
import * as authController from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required' });
    }

    const result = await authController.register(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const result = await authController.login(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/demo', async (req, res, next) => {
  try {
    const result = await authController.demo(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

router.put('/profile', authenticate, async (req, res, next) => {
  try {
    const result = await authController.updateProfile(req.user.userId, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
