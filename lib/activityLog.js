/**
 * Log an activity event to the activityLogs collection.
 * @param {Db} db - MongoDB database instance
 * @param {Object} params
 * @param {string} params.userId - ID of the user performing the action
 * @param {string} params.userName - Display name of the user
 * @param {string} params.action - Action type: 'create' | 'update' | 'delete' | 'login' | 'status_change'
 * @param {string} params.target - Description of the target (e.g., "Teacher: John Doe")
 * @param {Object} [params.details] - Optional additional details
 */
export async function logActivity(db, { userId, userName, action, target, details = {} }) {
  try {
    await db.collection('activityLogs').insertOne({
      userId,
      userName,
      action,
      target,
      details,
      timestamp: new Date(),
    });
  } catch (error) {
    // Don't let logging failures break the main operation
    console.error('Failed to log activity:', error);
  }
}
