import {
  createDemoUser,
  loginUser,
  registerUser,
  updateUserProfile,
  verifyToken
} from '../services/authService.js';

export const register = async (payload) => registerUser(payload);

export const login = async (payload) => loginUser(payload);

export const demo = async (payload) => createDemoUser(payload);

export const me = async (token) => ({
  user: await verifyToken(token)
});

export const updateProfile = async (userId, payload) => ({
  user: await updateUserProfile(userId, payload)
});
