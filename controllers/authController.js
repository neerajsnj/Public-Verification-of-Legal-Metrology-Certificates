const bcrypt = require('bcryptjs');
const db = require('../database/db');
const auditService = require('../services/auditService');
const notificationService = require('../services/notificationService');

// GSTIN Regex for India (15 alphanumeric characters)
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const MOBILE_REGEX = /^[6-9]\d{9}$/;
const PINCODE_REGEX = /^\d{6}$/;

/**
 * Render Login Page
 */
function getLogin(req, res) {
    if (req.session.user) {
        if (req.session.user.role === 'merchant') return res.redirect('/merchant/dashboard');
        if (req.session.user.role === 'inspector') return res.redirect('/inspector/dashboard');
    }
    const redirect = req.query.redirect || '';
    const presetRole = req.query.role || 'merchant';
    res.render('auth/login', {
        title: 'Login - MetroVerify',
        redirect,
        presetRole
    });
}

/**
 * Process Login
 */
function postLogin(req, res) {
    const { email, password, role } = req.body;

    if (!email || !password) {
        req.flash('error', 'Please provide both email and password.');
        return res.redirect('/auth/login');
    }

    try {
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());

        if (!user) {
            req.flash('error', 'Invalid email or password.');
            return res.redirect('/auth/login');
        }

        const isMatch = bcrypt.compareSync(password, user.password_hash);
        if (!isMatch) {
            req.flash('error', 'Invalid email or password.');
            return res.redirect('/auth/login');
        }

        if (role && user.role !== role) {
            req.flash('error', `This account is registered as a ${user.role}, not an ${role}.`);
            return res.redirect(`/auth/login?role=${user.role}`);
        }

        // Set session
        req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        auditService.logAction(user.id, 'LOGIN', 'users', user.id, `User logged in with role ${user.role}`, req);

        req.flash('success', `Welcome back, ${user.name}!`);

        if (req.body.redirect && req.body.redirect.startsWith('/')) {
            return res.redirect(req.body.redirect);
        }

        if (user.role === 'merchant') {
            return res.redirect('/merchant/dashboard');
        } else if (user.role === 'inspector') {
            return res.redirect('/inspector/dashboard');
        } else {
            return res.redirect('/');
        }
    } catch (err) {
        console.error('Login Error:', err);
        req.flash('error', 'An internal server error occurred during login.');
        res.redirect('/auth/login');
    }
}

/**
 * Render Merchant Registration Page
 */
function getRegister(req, res) {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('auth/register', {
        title: 'Merchant Registration - MetroVerify'
    });
}

/**
 * Process Merchant Registration
 */
function postRegister(req, res) {
    const {
        business_name,
        name,
        gstin,
        mobile,
        email,
        password,
        confirm_password,
        address,
        district,
        state,
        pincode
    } = req.body;

    // Strict Validation
    const errors = [];

    if (!business_name || business_name.trim().length < 3) errors.push('Business name must be at least 3 characters.');
    if (!name || name.trim().length < 3) errors.push('Authorized owner/signatory name is required.');
    
    const cleanGstin = (gstin || '').trim().toUpperCase();
    if (!GSTIN_REGEX.test(cleanGstin)) {
        errors.push('Invalid GSTIN format. Must be a valid 15-character Indian GSTIN (e.g., 07AAAAA0000A1Z5).');
    }

    const cleanMobile = (mobile || '').trim();
    if (!MOBILE_REGEX.test(cleanMobile)) {
        errors.push('Mobile number must be a valid 10-digit Indian number starting with 6, 7, 8, or 9.');
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
        errors.push('A valid email address is required.');
    }

    if (!password || password.length < 6) {
        errors.push('Password must be at least 6 characters long.');
    }

    if (password !== confirm_password) {
        errors.push('Passwords do not match.');
    }

    if (!address || address.trim().length < 5) errors.push('Complete business address is required.');
    if (!district || district.trim().length < 2) errors.push('District is required.');
    if (!state || state.trim().length < 2) errors.push('State is required.');

    const cleanPincode = (pincode || '').trim();
    if (!PINCODE_REGEX.test(cleanPincode)) {
        errors.push('Pincode must be a 6-digit numeric postal code.');
    }

    if (errors.length > 0) {
        req.flash('error', errors.join(' '));
        return res.render('auth/register', {
            title: 'Merchant Registration - MetroVerify',
            formData: req.body
        });
    }

    try {
        // Check existing email
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
        if (existingUser) {
            req.flash('error', 'An account with this email address already exists. Please login instead.');
            return res.render('auth/register', {
                title: 'Merchant Registration - MetroVerify',
                formData: req.body
            });
        }

        // Check existing GSTIN
        const existingGstin = db.prepare('SELECT id FROM merchants WHERE gstin = ?').get(cleanGstin);
        if (existingGstin) {
            req.flash('error', 'An establishment with this GSTIN is already registered.');
            return res.render('auth/register', {
                title: 'Merchant Registration - MetroVerify',
                formData: req.body
            });
        }

        const passwordHash = bcrypt.hashSync(password, 10);

        // Transactional insert
        const registerTx = db.transaction(() => {
            const userInsert = db.prepare(`
                INSERT INTO users (role, name, email, password_hash, created_at)
                VALUES ('merchant', ?, ?, ?, datetime('now', 'localtime'))
            `);
            const userResult = userInsert.run(name.trim(), cleanEmail, passwordHash);
            const userId = userResult.lastInsertRowid;

            const merchantInsert = db.prepare(`
                INSERT INTO merchants (user_id, business_name, gstin, address, district, state, pincode, mobile)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            merchantInsert.run(
                userId,
                business_name.trim(),
                cleanGstin,
                address.trim(),
                district.trim(),
                state.trim(),
                cleanPincode,
                cleanMobile
            );

            return { userId, name: name.trim(), email: cleanEmail };
        });

        const newMerchant = registerTx();

        // Audit log
        auditService.logAction(newMerchant.userId, 'REGISTER_MERCHANT', 'merchants', newMerchant.userId, `Registered new merchant: ${business_name.trim()} (${cleanGstin})`, req);

        // Notifications
        notificationService.sendNotification(
            newMerchant.userId,
            'Welcome to MetroVerify',
            `Your merchant profile for "${business_name.trim()}" has been successfully created. You can now register instruments and apply for legal verification.`,
            'SMS'
        );
        notificationService.sendNotification(
            newMerchant.userId,
            'Registration Confirmed',
            `Dear ${newMerchant.name}, your account is activated with GSTIN ${cleanGstin}. Welcome to the Ministry of Consumer Affairs Legal Metrology Online Verification System.`,
            'Email'
        );

        // Auto login
        req.session.user = {
            id: newMerchant.userId,
            name: newMerchant.name,
            email: newMerchant.email,
            role: 'merchant'
        };

        req.flash('success', 'Registration successful! Welcome to MetroVerify.');
        res.redirect('/merchant/dashboard');

    } catch (err) {
        console.error('Registration Error:', err);
        req.flash('error', 'Registration failed due to a database error. Please verify your information.');
        res.render('auth/register', {
            title: 'Merchant Registration - MetroVerify',
            formData: req.body
        });
    }
}

/**
 * Logout
 */
function logout(req, res) {
    if (req.session.user) {
        auditService.logAction(req.session.user.id, 'LOGOUT', 'users', req.session.user.id, 'User logged out', req);
    }
    req.session.destroy(() => {
        res.redirect('/?loggedOut=true');
    });
}

module.exports = {
    getLogin,
    postLogin,
    getRegister,
    postRegister,
    logout
};
