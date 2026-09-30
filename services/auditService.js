const db = require('../database/db');

/**
 * Record an audit log entry
 * @param {number|null} userId 
 * @param {string} action 
 * @param {string} entity 
 * @param {string|number} entityId 
 * @param {string|object} details 
 * @param {object} [req] 
 */
function logAction(userId, action, entity, entityId, details = '', req = null) {
    try {
        let ipAddress = '127.0.0.1';
        if (req) {
            ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
        }
        const detailStr = typeof details === 'object' ? JSON.stringify(details) : String(details);
        
        const stmt = db.prepare(`
            INSERT INTO audit_log (user_id, action, entity, entity_id, ip_address, details, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
        `);
        stmt.run(userId || null, action, entity, String(entityId || ''), ipAddress, detailStr);
    } catch (err) {
        console.error('Audit Log Error:', err.message);
    }
}

/**
 * Fetch recent audit logs with user info
 * @param {number} limit 
 */
function getRecentLogs(limit = 100) {
    try {
        const stmt = db.prepare(`
            SELECT a.*, u.name as user_name, u.role as user_role, u.email as user_email
            FROM audit_log a
            LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.id DESC
            LIMIT ?
        `);
        return stmt.all(limit);
    } catch (err) {
        console.error('Get Audit Logs Error:', err.message);
        return [];
    }
}

module.exports = {
    logAction,
    getRecentLogs
};
