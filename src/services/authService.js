import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../models/User.js';
import { UserIntelligenceProfile } from '../models/AdaptiveIntelligence.js';

const tokenSecret = () => process.env.JWT_SECRET || 'dev-only-change-me';

const sanitizeUser = (user) => ({
  userId: user.publicId,
  name: user.name,
  email: user.email,
  role: user.role,
  userCategory: user.userCategory,
  accessibilityProfile: user.accessibilityProfile
});

const createToken = (user) => jwt.sign(
  {
    sub: user.publicId,
    role: user.role,
    userCategory: user.userCategory
  },
  tokenSecret(),
  { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
);

export const registerUser = async ({
  name,
  email,
  password,
  userCategory = 'moderate',
  accessibilityProfile = {}
}) => {
  const existing = email ? await User.findOne({ email: email.toLowerCase() }) : null;
  if (existing) {
    const error = new Error('Email already registered');
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;
  const user = await User.create({
    publicId: `user_${uuidv4().split('-')[0]}`,
    name,
    email,
    passwordHash,
    userCategory,
    accessibilityProfile
  });

  await UserIntelligenceProfile.findOneAndUpdate(
    { userId: user.publicId },
    {
      $setOnInsert: { userId: user.publicId },
      $set: {
        accessibilityPreferences: {
          language: user.accessibilityProfile.language || 'en',
          voiceGuidance: Boolean(user.accessibilityProfile.voiceGuidance),
          largeText: user.accessibilityProfile.largeText !== false,
          slowMode: Boolean(user.accessibilityProfile.slowMode)
        }
      }
    },
    { upsert: true }
  );

  return {
    token: createToken(user),
    user: sanitizeUser(user)
  };
};

export const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email: email?.toLowerCase() });
  if (!user || !user.passwordHash) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  user.lastLoginAt = new Date();
  await user.save();

  return {
    token: createToken(user),
    user: sanitizeUser(user)
  };
};

export const createDemoUser = async ({ name = 'Demo User', userCategory = 'elderly' } = {}) => {
  const user = await User.create({
    publicId: `user_${uuidv4().split('-')[0]}`,
    name,
    role: 'demo',
    userCategory,
    accessibilityProfile: {
      language: 'en',
      voiceGuidance: userCategory === 'elderly' || userCategory === 'highly_confused',
      largeText: true,
      slowMode: userCategory === 'elderly' || userCategory === 'highly_confused',
      preferredInstructionStyle: 'adaptive'
    }
  });

  await UserIntelligenceProfile.findOneAndUpdate(
    { userId: user.publicId },
    {
      $setOnInsert: { userId: user.publicId },
      $set: {
        accessibilityPreferences: {
          language: user.accessibilityProfile.language,
          voiceGuidance: user.accessibilityProfile.voiceGuidance,
          largeText: user.accessibilityProfile.largeText,
          slowMode: user.accessibilityProfile.slowMode
        }
      }
    },
    { upsert: true }
  );

  return {
    token: createToken(user),
    user: sanitizeUser(user)
  };
};

export const updateUserProfile = async (userId, updates = {}) => {
  const user = await User.findOneAndUpdate(
    { publicId: userId },
    {
      $set: {
        ...(updates.name && { name: updates.name }),
        ...(updates.userCategory && { userCategory: updates.userCategory }),
        ...(updates.accessibilityProfile && { accessibilityProfile: updates.accessibilityProfile })
      }
    },
    { new: true }
  );

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return sanitizeUser(user);
};

export const verifyToken = async (token) => {
  const decoded = jwt.verify(token, tokenSecret());
  const user = await User.findOne({ publicId: decoded.sub });
  if (!user) {
    const error = new Error('Invalid token user');
    error.statusCode = 401;
    throw error;
  }
  return sanitizeUser(user);
};
