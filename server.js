const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const helmet = require('helmet');
const path = require('path');
const db = require('./database/db'); // Ensures database tables exist

const csrfProtection = require('./middleware/csrf');
const { attachUser } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const publicRoutes = require('./routes/public');
const merchantRoutes = require('./routes/merchant');
const inspectorRoutes = require('./routes/inspector');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Headers with Helmet
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "blob:", "https://*"],
            connectSrc: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

// Body parsing
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

// Static Assets
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'metroverify-sih2026-secret-key-982183719',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

// Flash messages
app.use(flash());

// CSRF Protection
app.use(csrfProtection);

// Attach current user & notifications to res.locals
app.use(attachUser);

// Flash locals & path helper
app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.info = req.flash('info');
    res.locals.currentPath = req.path;
    next();
});

// Mount Routes
app.use('/', publicRoutes);
app.use('/auth', authRoutes);
app.use('/merchant', merchantRoutes);
app.use('/inspector', inspectorRoutes);
app.use('/api', apiRoutes);

// 404 Handler
app.use((req, res, next) => {
    res.status(404).render('error', {
        title: 'Page Not Found - MetroVerify',
        status: 404,
        message: 'The page or resource you requested could not be located on the MetroVerify portal.'
    });
});

// 500 Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Application Error:', err);
    res.status(500).render('error', {
        title: 'System Error - MetroVerify',
        status: 500,
        message: err.message || 'An internal system error occurred while processing your request.'
    });
});

// Start Server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`====================================================`);
        console.log(`  MetroVerify - Legal Metrology Verification System `);
        console.log(`  Smart India Hackathon 2026 (Problem SIH26036)     `);
        console.log(`  Server running at http://localhost:${PORT}        `);
        console.log(`====================================================`);
    });
}

module.exports = app;
