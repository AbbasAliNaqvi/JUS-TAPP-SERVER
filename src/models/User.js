import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  publicId: { type: String, unique: true, required: true, index: true },
  name: { type: String, required: true },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  passwordHash: String,
  role: { type: String, enum: ['user', 'admin', 'demo'], default: 'user' },
  userCategory: {
    type: String,
    enum: ['confident', 'moderate', 'elderly', 'first_time', 'highly_confused'],
    default: 'moderate'
  },
  accessibilityProfile: {
    language: { type: String, default: 'en' },
    voiceGuidance: { type: Boolean, default: false },
    largeText: { type: Boolean, default: true },
    slowMode: { type: Boolean, default: false },
    preferredInstructionStyle: { type: String, default: 'adaptive' }
  },
  lastLoginAt: Date
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
