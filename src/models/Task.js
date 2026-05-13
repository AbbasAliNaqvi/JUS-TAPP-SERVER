import mongoose from 'mongoose';

const taskStepSchema = new mongoose.Schema({
  stepIndex: { type: Number, required: true },
  instruction: { type: String, required: true },
  targetAppPackage: String,
  targetElement: String,
  matchText: String,
  actionType: { 
    type: String, 
    enum: ['tap', 'swipe', 'input', 'scroll', 'openApp', 'long-press', 'double-tap', 'drag', 'wait', 'voice-input'],
    default: 'tap' 
  },
  status: { type: String, enum: ['pending', 'executing', 'completed'], default: 'pending' },
  startedAt: Date,
  completedAt: Date
});

const taskSchema = new mongoose.Schema({
  publicId: { type: String, unique: true, sparse: true, index: true },
  userId: { type: String, required: true, index: true },
  description: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'planning', 'executing', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  appPackageName: String,
  steps: [taskStepSchema],
  currentStepIndex: { type: Number, default: 0 },
  estimatedDuration: Number, // in seconds
  actualDuration: Number,
  metadata: {
    language: { type: String, default: 'en' },
    userAge: String,
    deviceInfo: String
  },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
  completedAt: Date
}, { timestamps: true });

taskSchema.index({ userId: 1, createdAt: -1 });
taskSchema.index({ status: 1, userId: 1 });

export const Task = mongoose.model('Task', taskSchema);

// Session Schema for tracking user assistance sessions
const sessionSchema = new mongoose.Schema({
  publicId: { type: String, unique: true, sparse: true, index: true },
  userId: { type: String, required: true, index: true },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
  sessionStartTime: { type: Date, default: Date.now },
  sessionEndTime: Date,
  status: { type: String, enum: ['active', 'paused', 'completed', 'failed'], default: 'active', index: true },
  currentStepIndex: { type: Number, default: 0 },
  confusionLevel: {
    type: String,
    enum: ['independent_user', 'moderate_assistance_needed', 'high_assistance_needed', 'critical_guidance_required'],
    default: 'independent_user'
  },
  confusionScore: { type: Number, default: 0 },
  guidanceTier: { type: String, default: 'minimal' },
  stepsCompleted: Number,
  totalSteps: Number,
  errorsEncountered: [String],
  userInterruptions: Number,
  success: Boolean,
  progress: Number,
  notes: String,
  deviceInfo: {
    osVersion: String,
    screenSize: String,
    appVersion: String,
    platform: String,
    deviceModel: String
  }
}, { timestamps: true });

sessionSchema.index({ userId: 1, sessionStartTime: -1 });

export const Session = mongoose.model('Session', sessionSchema);
