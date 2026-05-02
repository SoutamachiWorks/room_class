import { ObjectId } from 'mongodb';

/**
 * Creates a single notification for a specific user.
 * 
 * @param {Object} db - MongoDB database instance
 * @param {Object} payload - Notification data
 * @param {string|ObjectId} payload.userId - ID of the recipient user (from users collection)
 * @param {string} payload.title - Short title of the notification
 * @param {string} payload.message - Detailed message
 * @param {string} [payload.type='info'] - Type of notification: 'info', 'success', 'warning'
 * @param {string} [payload.actionUrl=null] - URL to redirect to when clicked
 */
export async function createNotification(db, {
  userId,
  title,
  message,
  type = 'info',
  actionUrl = null,
}) {
  try {
    const notification = {
      userId: typeof userId === 'string' ? userId : userId.toString(),
      title,
      message,
      type,
      isRead: false,
      actionUrl,
      createdAt: new Date(),
    };
    await db.collection('notifications').insertOne(notification);
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}

/**
 * Creates notifications for all students in a specific class.
 * 
 * @param {Object} db - MongoDB database instance
 * @param {string} classCode - Class code to target (e.g., 'X-IPA-1')
 * @param {Object} payload - Notification data (title, message, type, actionUrl)
 */
export async function createNotificationsForClass(db, classCode, {
  title,
  message,
  type = 'info',
  actionUrl = null,
}) {
  try {
    // Find all students in this class
    const students = await db.collection('users')
      .find({ role: 'student', classCode })
      .project({ _id: 1 })
      .toArray();

    if (students.length === 0) return;

    const notifications = students.map(student => ({
      userId: student._id.toString(),
      title,
      message,
      type,
      isRead: false,
      actionUrl,
      createdAt: new Date(),
    }));

    await db.collection('notifications').insertMany(notifications);
  } catch (error) {
    console.error(`Failed to create notifications for class ${classCode}:`, error);
  }
}
