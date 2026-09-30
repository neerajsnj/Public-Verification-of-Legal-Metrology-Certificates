const db = require('../database/db');

/**
 * Sends and persists a notification for a user (simulating SMS, Email, System alerts)
 * @param {number} userId 
 * @param {string} title 
 * @param {string} message 
 * @param {'SMS'|'Email'|'System'} channel 
 */
function sendNotification(userId, title, message, channel = 'System') {
    try {
        const stmt = db.prepare(`
            INSERT INTO notifications (user_id, title, message, channel, is_read, created_at)
            VALUES (?, ?, ?, ?, 0, datetime('now', 'localtime'))
        `);
        stmt.run(userId, title, message, channel);
    } catch (err) {
        console.error('Notification Error:', err.message);
    }
}

/**
 * Send simulated dual-channel (SMS + Email) notification
 */
function sendMultiChannelNotification(userId, title, message) {
    sendNotification(userId, title, message, 'SMS');
    sendNotification(userId, title, message, 'Email');
}

/**
 * Fetch unread and recent notifications for a user
 * @param {number} userId 
 * @param {number} limit 
 */
function getUserNotifications(userId, limit = 20) {
    try {
        const stmt = db.prepare(`
            SELECT * FROM notifications
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT ?
        `);
        return stmt.all(userId, limit);
    } catch (err) {
        console.error('Get Notifications Error:', err.message);
        return [];
    }
}

/**
 * Mark all notifications as read for a user
 * @param {number} userId 
 */
function markAllAsRead(userId) {
    try {
        const stmt = db.prepare(`
            UPDATE notifications
            SET is_read = 1
            WHERE user_id = ?
        `);
        return stmt.run(userId);
    } catch (err) {
        console.error('Mark Read Error:', err.message);
    }
}

module.exports = {
    sendNotification,
    sendMultiChannelNotification,
    getUserNotifications,
    markAllAsRead
};
