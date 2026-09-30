const crypto = require('crypto');

/**
 * Session-based CSRF protection middleware
 */
function csrfProtection(req, res, next) {
    // Generate CSRF token if not already in session
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(24).toString('hex');
    }

    res.locals.csrfToken = req.session.csrfToken;

    // Only validate mutative HTTP methods
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
        return next();
    }

    const token = req.body?._csrf || req.headers['x-csrf-token'];

    if (!token || token !== req.session.csrfToken) {
        // Fallback for upload forms if token is in body or query
        if (req.query?._csrf && req.query._csrf === req.session.csrfToken) {
            return next();
        }
        console.warn(`CSRF validation failed for ${req.method} ${req.originalUrl}`);
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(403).json({ error: 'Invalid or expired CSRF token. Please refresh the page.' });
        }
        req.flash('error', 'Security check failed (CSRF token expired). Please try again.');
        return res.redirect('back');
    }

    next();
}

module.exports = csrfProtection;
