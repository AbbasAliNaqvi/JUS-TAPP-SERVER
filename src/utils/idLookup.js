import mongoose from 'mongoose';

export const buildTaskLookup = (taskId) => (
  mongoose.isValidObjectId(taskId)
    ? { $or: [{ _id: taskId }, { publicId: taskId }] }
    : { publicId: taskId }
);

export const buildSessionLookup = (sessionId) => (
  mongoose.isValidObjectId(sessionId)
    ? { $or: [{ _id: sessionId }, { publicId: sessionId }] }
    : { publicId: sessionId }
);

export const notFoundError = (entity) => {
  const error = new Error(`${entity} not found`);
  error.statusCode = 404;
  return error;
};
