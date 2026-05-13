import mongoose from 'mongoose';

const featureSnapshotSchema = new mongoose.Schema({
  repeatedTaps: { type: Number, default: 0 },
  incorrectTaps: { type: Number, default: 0 },
  inactivityMs: { type: Number, default: 0 },
  navigationRetries: { type: Number, default: 0 },
  backButtonCount: { type: Number, default: 0 },
  gestureAccuracy: { type: Number, default: 1 },
  taskCompletionMs: { type: Number, default: 0 },
  overlayRequestCount: { type: Number, default: 0 },
  hesitationMs: { type: Number, default: 0 },
  wrongScreenCount: { type: Number, default: 0 },
  sameScreenLoopCount: { type: Number, default: 0 },
  stepDurationMs: { type: Number, default: 0 },
  totalTapCount: { type: Number, default: 0 },
  voiceHelpCount: { type: Number, default: 0 }
}, { _id: false });

const interactionEventSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', index: true },
  sessionPublicId: { type: String, index: true },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', index: true },
  taskPublicId: { type: String, index: true },
  userId: { type: String, required: true, index: true },
  stepIndex: { type: Number, default: 0, index: true },
  eventType: {
    type: String,
    required: true,
    enum: [
      'tap',
      'incorrect_tap',
      'repeated_tap',
      'back',
      'gesture',
      'inactivity',
      'navigation_retry',
      'overlay_request',
      'hesitation',
      'wrong_screen',
      'same_screen_loop',
      'voice_help',
      'step_started',
      'step_completed'
    ]
  },
  value: { type: Number, default: 1 },
  durationMs: { type: Number, default: 0 },
  screenName: String,
  targetText: String,
  targetElement: String,
  expectedElement: String,
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  clientTimestamp: Date
}, { timestamps: true });

interactionEventSchema.index({ userId: 1, createdAt: -1 });
interactionEventSchema.index({ sessionPublicId: 1, stepIndex: 1, createdAt: -1 });

const confusionPredictionSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', index: true },
  sessionPublicId: { type: String, index: true },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', index: true },
  taskPublicId: { type: String, index: true },
  userId: { type: String, required: true, index: true },
  stepIndex: { type: Number, default: 0 },
  level: {
    type: String,
    enum: [
      'independent_user',
      'moderate_assistance_needed',
      'high_assistance_needed',
      'critical_guidance_required'
    ],
    required: true
  },
  score: { type: Number, required: true },
  confidence: { type: Number, required: true },
  modelName: { type: String, default: 'heuristic-v1' },
  modelVersion: { type: String, default: '1.0.0' },
  features: { type: featureSnapshotSchema, default: {} },
  reasons: [String]
}, { timestamps: true });

confusionPredictionSchema.index({ sessionPublicId: 1, createdAt: -1 });

const guidanceVersionSchema = new mongoose.Schema({
  publicId: { type: String, unique: true, sparse: true, index: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', index: true },
  sessionPublicId: { type: String, index: true },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', index: true },
  taskPublicId: { type: String, index: true },
  userId: { type: String, required: true, index: true },
  stepIndex: { type: Number, default: 0 },
  confusionLevel: String,
  guidanceTier: String,
  overlayMode: String,
  originalStep: { type: mongoose.Schema.Types.Mixed, default: {} },
  adaptedStep: { type: mongoose.Schema.Types.Mixed, default: {} },
  promptContext: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

guidanceVersionSchema.index({ sessionPublicId: 1, createdAt: -1 });

const userIntelligenceProfileSchema = new mongoose.Schema({
  userId: { type: String, unique: true, required: true, index: true },
  baselineConfusionScore: { type: Number, default: 0 },
  averageGestureAccuracy: { type: Number, default: 1 },
  preferredGuidanceTier: { type: String, default: 'standard' },
  totalSessions: { type: Number, default: 0 },
  totalEvents: { type: Number, default: 0 },
  lastPredictionLevel: String,
  accessibilityPreferences: {
    voiceGuidance: { type: Boolean, default: false },
    largeText: { type: Boolean, default: true },
    slowMode: { type: Boolean, default: false },
    language: { type: String, default: 'en' }
  }
}, { timestamps: true });

export const InteractionEvent = mongoose.model('InteractionEvent', interactionEventSchema);
export const ConfusionPrediction = mongoose.model('ConfusionPrediction', confusionPredictionSchema);
export const GuidanceVersion = mongoose.model('GuidanceVersion', guidanceVersionSchema);
export const UserIntelligenceProfile = mongoose.model('UserIntelligenceProfile', userIntelligenceProfileSchema);
