const express = require('express');
const router = express.Router();
const notificationService = require('../services/notificationService');
const { requireAuth } = require('../middleware/auth');

router.post('/notifications/mark-read', requireAuth, (req, res) => {
    try {
        notificationService.markAllAsRead(req.session.user.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to mark notifications read' });
    }
});

module.exports = router;
