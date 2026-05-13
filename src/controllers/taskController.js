import { Task, Session } from '../models/Task.js';
import { UserIntelligenceProfile } from '../models/AdaptiveIntelligence.js';
import TaskPlanService from '../services/taskPlanService.js';
import { v4 as uuidv4 } from 'uuid';
import { buildTaskLookup, buildSessionLookup, notFoundError } from '../utils/idLookup.js';

const serializeTask = (task) => ({
  ...task.toObject(),
  taskId: task.publicId || task._id.toString(),
  mongoId: task._id.toString()
});

const serializeSession = (session) => ({
  ...session.toObject(),
  sessionId: session.publicId || session._id.toString(),
  mongoId: session._id.toString()
});

export const generateTaskPlan = async (taskDescription, userId, language = 'en') => {
  try {
    // Try Gemini first, fallback to Groq, then Ollama
    let plan;
    let lastError;
    
    if (process.env.GEMINI_API_KEY) {
      try {
        plan = await TaskPlanService.generatePlanWithGemini(taskDescription, userId, language);
      } catch (error) {
        console.warn('Gemini failed, trying Groq:', error.message);
        lastError = error;
        if (process.env.GROQ_API_KEY) {
          try {
            plan = await TaskPlanService.generatePlanWithGroq(taskDescription, userId, language);
          } catch (error) {
            console.warn('Groq failed after Gemini:', error.message);
            lastError = error;
          }
        }
      }
    }
    
    if (!plan && process.env.GROQ_API_KEY) {
      try {
        plan = await TaskPlanService.generatePlanWithGroq(taskDescription, userId, language);
      } catch (error) {
        console.warn('Groq failed, trying Ollama:', error.message);
        lastError = error;
      }
    }
    
    if (!plan) {
      try {
        plan = await TaskPlanService.generatePlanWithOllama(taskDescription, userId, language);
      } catch (error) {
        console.warn('Ollama failed, using fallback plan:', error.message);
        lastError = error;
      }
    }

    if (!plan) {
      console.warn('All providers failed, returning fallback plan');
      plan = TaskPlanService.generateFallbackPlan(taskDescription);
    }

    // Save task to database
    const task = new Task({
      publicId: `task_${uuidv4().split('-')[0]}`,
      userId,
      description: taskDescription,
      status: 'planning',
      appPackageName: plan.appPackageName,
      steps: plan.steps.map(step => ({
        stepIndex: step.stepIndex,
        instruction: step.instruction,
        targetAppPackage: step.targetAppPackage,
        targetElement: step.targetElement,
        matchText: step.matchText,
        actionType: step.actionType,
        status: 'pending'
      })),
      estimatedDuration: plan.estimatedDuration,
      metadata: {
        language,
        userAge: 'unknown',
        deviceInfo: 'unknown'
      }
    });

    await task.save();

    return {
      success: true,
      plan: {
        taskId: task.publicId,
        mongoId: task._id.toString(),
        description: task.description,
        appPackageName: task.appPackageName,
        steps: task.steps,
        estimatedDuration: task.estimatedDuration
      }
    };
  } catch (error) {
    console.error('Error generating task plan:', error);
    const fallbackPlan = TaskPlanService.generateFallbackPlan(taskDescription);
    return {
      success: true,
      plan: {
        taskId: fallbackPlan.taskId,
        description: fallbackPlan.description,
        appPackageName: fallbackPlan.appPackageName,
        steps: fallbackPlan.steps,
        estimatedDuration: fallbackPlan.estimatedDuration
      }
    };
  }
};

export const generateAdaptiveTaskPlan = async ({
  taskDescription,
  userId,
  language = 'en',
  confusionLevel = 'independent_user',
  userCategory = 'moderate',
  currentScreen = '',
  recentBehavior = {}
}) => {
  try {
    const guidanceTier = confusionLevel === 'critical_guidance_required'
      ? 'critical'
      : confusionLevel === 'high_assistance_needed'
        ? 'detailed'
        : confusionLevel === 'moderate_assistance_needed'
          ? 'standard'
          : 'minimal';
    const plan = await TaskPlanService.generateAdaptiveTaskPlan(taskDescription, userId, {
      language,
      confusionLevel,
      userCategory,
      currentScreen,
      recentBehavior
    });

    const task = new Task({
      publicId: `task_${uuidv4().split('-')[0]}`,
      userId,
      description: taskDescription,
      status: 'planning',
      appPackageName: plan.appPackageName,
      steps: plan.steps.map(step => ({
        stepIndex: step.stepIndex,
        instruction: step.instruction,
        targetAppPackage: step.targetAppPackage,
        targetElement: step.targetElement,
        matchText: step.matchText,
        actionType: step.actionType,
        status: 'pending'
      })),
      estimatedDuration: plan.estimatedDuration,
      metadata: {
        language,
        userAge: userCategory,
        deviceInfo: JSON.stringify({
          confusionLevel,
          currentScreen,
          recentBehavior
        })
      }
    });

    await task.save();

    return {
      success: true,
      adaptive: true,
      confusionLevel,
      guidanceTier,
      plan: {
        taskId: task.publicId,
        mongoId: task._id.toString(),
        description: task.description,
        appPackageName: task.appPackageName,
        steps: task.steps,
        estimatedDuration: task.estimatedDuration
      }
    };
  } catch (error) {
    console.error('Error generating adaptive task plan:', error);
    throw error;
  }
};

export const getTask = async (taskId) => {
  try {
    const task = await Task.findOne(buildTaskLookup(taskId));
    if (!task) {
      throw notFoundError('Task');
    }
    return serializeTask(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    throw error;
  }
};

export const updateTaskStep = async (taskId, stepIndex, status) => {
  try {
    const task = await Task.findOne(buildTaskLookup(taskId));
    if (!task) {
      throw notFoundError('Task');
    }

    if (stepIndex < 0 || stepIndex >= task.steps.length) {
      throw new Error('Invalid step index');
    }

    task.steps[stepIndex].status = status;
    if (status === 'executing') {
      task.steps[stepIndex].startedAt = task.steps[stepIndex].startedAt || new Date();
      task.status = 'executing';
      task.currentStepIndex = Math.max(task.currentStepIndex || 0, stepIndex);
    }
    if (status === 'completed') {
      task.steps[stepIndex].completedAt = new Date();
      task.steps[stepIndex].startedAt = task.steps[stepIndex].startedAt || new Date();
      task.currentStepIndex = Math.min(stepIndex + 1, task.steps.length);
    }

    // Check if all steps completed
    const allCompleted = task.steps.every(s => s.status === 'completed');
    if (allCompleted) {
      task.status = 'completed';
      task.completedAt = new Date();
    }

    await task.save();
    return serializeTask(task);
  } catch (error) {
    console.error('Error updating task step:', error);
    throw error;
  }
};

export const getMasterStep = async (taskId) => {
  try {
    const task = await Task.findOne(buildTaskLookup(taskId));
    if (!task) {
      throw notFoundError('Task');
    }

    const nextStep = task.steps.find(step => step.status !== 'completed') || null;
    const highlightText = nextStep?.matchText || nextStep?.targetElement || nextStep?.instruction || '';

    return {
      taskId: task.publicId || task._id.toString(),
      mongoId: task._id.toString(),
      status: task.status,
      currentStepIndex: task.currentStepIndex,
      totalSteps: task.steps.length,
      nextStep,
      highlightText
    };
  } catch (error) {
    console.error('Error fetching master step:', error);
    throw error;
  }
};

export const getUserTasks = async (userId, limit = 20, skip = 0) => {
  try {
    const tasks = await Task.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);
    
    const total = await Task.countDocuments({ userId });

    return {
      tasks: tasks.map(serializeTask),
      total,
      limit,
      skip,
      hasMore: skip + limit < total
    };
  } catch (error) {
    console.error('Error fetching user tasks:', error);
    throw error;
  }
};

export const createSession = async (userId, taskId, deviceInfo = {}) => {
  try {
    const task = taskId ? await Task.findOne(buildTaskLookup(taskId)) : null;
    if (taskId && !task) {
      throw notFoundError('Task');
    }

    const session = new Session({
      publicId: `session_${uuidv4().split('-')[0]}`,
      userId,
      taskId: task?._id,
      totalSteps: task?.steps?.length || 0,
      deviceInfo,
      sessionStartTime: new Date()
    });

    await session.save();
    await UserIntelligenceProfile.findOneAndUpdate(
      { userId },
      { $inc: { totalSessions: 1 }, $setOnInsert: { userId } },
      { upsert: true }
    );
    return serializeSession(session);
  } catch (error) {
    console.error('Error creating session:', error);
    throw error;
  }
};

export const updateSession = async (sessionId, updates) => {
  try {
    const session = await Session.findOneAndUpdate(
      buildSessionLookup(sessionId),
      updates,
      { new: true }
    );
    
    if (!session) {
      throw notFoundError('Session');
    }

    return serializeSession(session);
  } catch (error) {
    console.error('Error updating session:', error);
    throw error;
  }
};

export const getUserSessions = async (userId, limit = 50) => {
  try {
    const sessions = await Session.find({ userId })
      .sort({ sessionStartTime: -1 })
      .limit(limit)
      .populate('taskId', 'description status');

    return sessions.map(serializeSession);
  } catch (error) {
    console.error('Error fetching user sessions:', error);
    throw error;
  }
};
