const db = require('../database/db');
const notificationService = require('../services/notificationService');

/**
 * Attaches current authenticated user and profile to res.locals
 */
function attachUser(req, res, next) {
    res.locals.currentUser = req.session.user || null;
    res.locals.merchantProfile = null;
    res.locals.inspectorProfile = null;
    res.locals.notifications = [];
    res.locals.unreadNotifsCount = 0;

    if (req.session.user) {
        try {
            if (req.session.user.role === 'merchant') {
                const merchant = db.prepare('SELECT * FROM merchants WHERE user_id = ?').get(req.session.user.id);
                res.locals.merchantProfile = merchant || null;
            } else if (req.session.user.role === 'inspector') {
                const inspector = db.prepare('SELECT * FROM inspectors WHERE user_id = ?').get(req.session.user.id);
                res.locals.inspectorProfile = inspector || null;
            }

            const notifs = notificationService.getUserNotifications(req.session.user.id, 10);
            res.locals.notifications = notifs;
            res.locals.unreadNotifsCount = notifs.filter(n => !n.is_read).length;
        } catch (err) {
            console.error('Error attaching user profiles:', err);
        }
    }
    next();
}

/**
 * Requires an active user session
 */
function requireAuth(req, res, next) {
    if (!req.session.user) {
        req.flash('error', 'Please log in to access this page.');
        return res.redirect(`/auth/login?redirect=${encodeURIComponent(req.originalUrl)}`);
    }
    next();
}

/**
 * Requires specific user role(s)
 * @param {string|string[]} roles 
 */
function requireRole(roles) {
    const allowed = Array.isArray(roles) ? roles : [roles];
    return (req, res, next) => {
        if (!req.session.user) {
            req.flash('error', 'Please log in to continue.');
            return res.redirect('/auth/login');
        }
        if (!allowed.includes(req.session.user.role)) {
            req.flash('error', 'Unauthorized access for your account role.');
            if (req.session.user.role === 'merchant') {
                return res.redirect('/merchant/dashboard');
            } else if (req.session.user.role === 'inspector') {
                return res.redirect('/inspector/dashboard');
            }
            return res.redirect('/');
        }
        next();
    };
}

module.exports = {
    attachUser,
    requireAuth,
    requireRole
};
