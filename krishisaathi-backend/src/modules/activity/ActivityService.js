const { v4: uuidv4 } = require('uuid');
const db = require('../../db/connection');

class ActivityService {
  async logActivity(user_id, action, summary, entity_type = null, entity_id = null, metadata = null) {
    await db('activity_feed').insert({
      id: uuidv4(),
      user_id,
      action,
      summary,
      entity_type,
      entity_id,
      metadata: metadata || null,
    });
  }

  async getRecentActivities(user_id, limit = 20) {
    return db('activity_feed')
      .where({ user_id })
      .orderBy('created_at', 'desc')
      .limit(limit);
  }
}

module.exports = new ActivityService();
