const db = require('../database/db');
const auditService = require('../services/auditService');
const notificationService = require('../services/notificationService');
const qrService = require('../services/qrService');
const path = require('path');
const fs = require('fs');

/**
 * Helper to get current merchant record
 */
function getMerchantByUserId(userId) {
    return db.prepare('SELECT * FROM merchants WHERE user_id = ?').get(userId);
}

/**
 * Merchant Dashboard
 */
function getDashboard(req, res) {
    try {
        const merchant = getMerchantByUserId(req.session.user.id);
        if (!merchant) {
            req.flash('error', 'Merchant profile not found.');
            return res.redirect('/');
        }

        // Metrics
        const totalInstruments = db.prepare('SELECT COUNT(*) as count FROM instruments WHERE merchant_id = ?').get(merchant.id)?.count || 0;
        
        const pendingApplications = db.prepare(`
            SELECT COUNT(*) as count FROM applications 
            WHERE merchant_id = ? AND status IN ('Submitted', 'Under Review', 'Scheduled')
        `).get(merchant.id)?.count || 0;

        const approvedApplications = db.prepare(`
            SELECT COUNT(*) as count FROM applications 
            WHERE merchant_id = ? AND status = 'Certificate Issued'
        `).get(merchant.id)?.count || 0;

        const rejectedApplications = db.prepare(`
            SELECT COUNT(*) as count FROM applications 
            WHERE merchant_id = ? AND status = 'Rejected'
        `).get(merchant.id)?.count || 0;

        // Upcoming appointments
        const upcomingAppointments = db.prepare(`
            SELECT appt.*, app.application_no, insp_user.name as inspector_name, insp.employee_id, insp.district as inspector_district
            FROM appointments appt
            JOIN applications app ON appt.application_id = app.id
            JOIN inspectors insp ON appt.inspector_id = insp.id
            JOIN users insp_user ON insp.user_id = insp_user.id
            WHERE app.merchant_id = ? AND appt.status = 'Scheduled' AND date(appt.scheduled_at) >= date('now', 'localtime')
            ORDER BY appt.scheduled_at ASC
            LIMIT 5
        `).all(merchant.id);

        // Expiring certificates (within 30 days)
        const expiringCertificates = db.prepare(`
            SELECT c.*, inst.type as instrument_type, inst.serial_no, inst.make_model
            FROM certificates c
            JOIN application_items ai ON c.application_item_id = ai.id
            JOIN instruments inst ON ai.instrument_id = inst.id
            WHERE inst.merchant_id = ? 
              AND c.status = 'valid'
              AND date(c.valid_until) >= date('now', 'localtime')
              AND date(c.valid_until) <= date('now', '+30 days')
            ORDER BY c.valid_until ASC
        `).all(merchant.id);

        // Recent applications
        const recentApplications = db.prepare(`
            SELECT app.*, COUNT(ai.id) as instrument_count
            FROM applications app
            LEFT JOIN application_items ai ON app.id = ai.application_id
            WHERE app.merchant_id = ?
            GROUP BY app.id
            ORDER BY app.id DESC
            LIMIT 5
        `).all(merchant.id);

        res.render('merchant/dashboard', {
            title: 'Merchant Dashboard - MetroVerify',
            merchant,
            stats: {
                totalInstruments,
                pendingApplications,
                approvedApplications,
                rejectedApplications
            },
            upcomingAppointments,
            expiringCertificates,
            recentApplications
        });

    } catch (err) {
        console.error('Merchant Dashboard Error:', err);
        req.flash('error', 'Error loading merchant dashboard.');
        res.redirect('/');
    }
}

/**
 * List Merchant Instruments
 */
function getInstruments(req, res) {
    try {
        const merchant = getMerchantByUserId(req.session.user.id);
        const instruments = db.prepare(`
            SELECT inst.*,
                   (SELECT c.cert_no FROM certificates c 
                    JOIN application_items ai ON c.application_item_id = ai.id 
                    WHERE ai.instrument_id = inst.id AND c.status = 'valid'
                    ORDER BY c.id DESC LIMIT 1) as active_cert_no,
                   (SELECT c.valid_until FROM certificates c 
                    JOIN application_items ai ON c.application_item_id = ai.id 
                    WHERE ai.instrument_id = inst.id AND c.status = 'valid'
                    ORDER BY c.id DESC LIMIT 1) as cert_valid_until
            FROM instruments inst
            WHERE inst.merchant_id = ?
            ORDER BY inst.id DESC
        `).all(merchant.id);

        res.render('merchant/instruments', {
            title: 'My Instruments - MetroVerify',
            instruments,
            merchant
        });
    } catch (err) {
        console.error('List Instruments Error:', err);
        req.flash('error', 'Error loading instruments.');
        res.redirect('/merchant/dashboard');
    }
}

/**
 * Add / Edit Instrument Form
 */
function getInstrumentForm(req, res) {
    try {
        const merchant = getMerchantByUserId(req.session.user.id);
        const instrumentId = req.params.id;
        let instrument = null;

        if (instrumentId) {
            instrument = db.prepare('SELECT * FROM instruments WHERE id = ? AND merchant_id = ?').get(instrumentId, merchant.id);
            if (!instrument) {
                req.flash('error', 'Instrument not found.');
                return res.redirect('/merchant/instruments');
            }
        }

        res.render('merchant/instrument-form', {
            title: instrument ? 'Edit Instrument - MetroVerify' : 'Add New Instrument - MetroVerify',
            instrument,
            merchant
        });
    } catch (err) {
        console.error('Get Instrument Form Error:', err);
        req.flash('error', 'Error loading form.');
        res.redirect('/merchant/instruments');
    }
}

/**
 * Save Instrument (Create or Update)
 */
function postInstrument(req, res) {
    try {
        const merchant = getMerchantByUserId(req.session.user.id);
        const instrumentId = req.params.id;

        const {
            type,
            make_model,
            serial_no,
            max_capacity,
            min_capacity,
            capacity_unit,
            accuracy_class,
            e_value,
            year_of_manufacture,
            location
        } = req.body;

        // Validation
        const errors = [];
        if (!type) errors.push('Instrument type is required.');
        if (!make_model || make_model.trim().length < 2) errors.push('Make and Model is required.');
        if (!serial_no || serial_no.trim().length < 2) errors.push('Serial Number is required.');

        const maxCap = parseFloat(max_capacity);
        const minCap = parseFloat(min_capacity);
        const eVal = parseFloat(e_value);
        const mfgYear = parseInt(year_of_manufacture, 10);
        const currentYear = new Date().getFullYear();

        if (isNaN(maxCap) || maxCap <= 0) errors.push('Maximum capacity must be greater than zero.');
        if (isNaN(minCap) || minCap < 0) errors.push('Minimum capacity cannot be negative.');
        if (minCap >= maxCap) errors.push('Minimum capacity must be strictly less than maximum capacity.');
        if (isNaN(eVal) || eVal <= 0) errors.push('Verification scale interval (e) must be a positive number.');
        if (isNaN(mfgYear) || mfgYear < 1970 || mfgYear > currentYear) {
            errors.push(`Year of manufacture must be between 1970 and ${currentYear}.`);
        }
        if (!location || location.trim().length < 2) errors.push('Location of use is required.');

        // Unique serial check
        const cleanSerial = serial_no.trim();
        const existing = db.prepare('SELECT id FROM instruments WHERE serial_no = ? AND id != ?').get(cleanSerial, instrumentId || 0);
        if (existing) {
            errors.push(`An instrument with serial number "${cleanSerial}" is already registered in the system.`);
        }

        if (errors.length > 0) {
            req.flash('error', errors.join(' '));
            return res.render('merchant/instrument-form', {
                title: instrumentId ? 'Edit Instrument - MetroVerify' : 'Add New Instrument - MetroVerify',
                instrument: { ...req.body, id: instrumentId },
                merchant
            });
        }

        if (instrumentId) {
            // Update
            const stmt = db.prepare(`
                UPDATE instruments
                SET type = ?, make_model = ?, serial_no = ?, max_capacity = ?, min_capacity = ?,
                    capacity_unit = ?, accuracy_class = ?, e_value = ?, year_of_manufacture = ?, location = ?
                WHERE id = ? AND merchant_id = ?
            `);
            stmt.run(type, make_model.trim(), cleanSerial, maxCap, minCap, capacity_unit || 'kg', accuracy_class, eVal, mfgYear, location.trim(), instrumentId, merchant.id);

            auditService.logAction(req.session.user.id, 'UPDATE_INSTRUMENT', 'instruments', instrumentId, `Updated instrument ${cleanSerial} (${type})`, req);
            req.flash('success', `Instrument ${cleanSerial} updated successfully.`);
        } else {
            // Insert
            const stmt = db.prepare(`
                INSERT INTO instruments (merchant_id, type, make_model, serial_no, max_capacity, min_capacity, capacity_unit, accuracy_class, e_value, year_of_manufacture, location, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'registered')
            `);
            const result = stmt.run(merchant.id, type, make_model.trim(), cleanSerial, maxCap, minCap, capacity_unit || 'kg', accuracy_class, eVal, mfgYear, location.trim());

            auditService.logAction(req.session.user.id, 'ADD_INSTRUMENT', 'instruments', result.lastInsertRowid, `Registered instrument ${cleanSerial} (${type})`, req);
            req.flash('success', `Instrument ${cleanSerial} registered successfully.`);
        }

        res.redirect('/merchant/instruments');

    } catch (err) {
        console.error('Save Instrument Error:', err);
        req.flash('error', 'Failed to save instrument.');
        res.redirect('/merchant/instruments');
    }
}

/**
 * Delete Instrument
 */
function deleteInstrument(req, res) {
    try {
        const merchant = getMerchantByUserId(req.session.user.id);
        const instrumentId = req.params.id;

        // Check if attached to any application
        const attachedApp = db.prepare(`
            SELECT app.application_no 
            FROM application_items ai 
            JOIN applications app ON ai.application_id = app.id
            WHERE ai.instrument_id = ? AND app.status NOT IN ('Rejected')
        `).get(instrumentId);

        if (attachedApp) {
            req.flash('error', `Cannot delete instrument because it is linked to application ${attachedApp.application_no}.`);
            return res.redirect('/merchant/instruments');
        }

        db.prepare('DELETE FROM instruments WHERE id = ? AND merchant_id = ?').run(instrumentId, merchant.id);
        auditService.logAction(req.session.user.id, 'DELETE_INSTRUMENT', 'instruments', instrumentId, `Deleted instrument ID ${instrumentId}`, req);
        
        req.flash('success', 'Instrument removed successfully.');
        res.redirect('/merchant/instruments');
    } catch (err) {
        console.error('Delete Instrument Error:', err);
        req.flash('error', 'Error removing instrument.');
        res.redirect('/merchant/instruments');
    }
}

/**
 * List Merchant Applications
 */
function getApplications(req, res) {
    try {
        const merchant = getMerchantByUserId(req.session.user.id);
        const applications = db.prepare(`
            SELECT app.*, 
                   COUNT(ai.id) as instrument_count,
                   GROUP_CONCAT(inst.type, ', ') as instrument_types
            FROM applications app
            LEFT JOIN application_items ai ON app.id = ai.application_id
            LEFT JOIN instruments inst ON ai.instrument_id = inst.id
            WHERE app.merchant_id = ?
            GROUP BY app.id
            ORDER BY app.id DESC
        `).all(merchant.id);

        res.render('merchant/applications', {
            title: 'My Verification Applications - MetroVerify',
            applications,
            merchant
        });
    } catch (err) {
        console.error('List Applications Error:', err);
        req.flash('error', 'Error loading applications.');
        res.redirect('/merchant/dashboard');
    }
}

/**
 * New Application Form
 */
function getNewApplication(req, res) {
    try {
        const merchant = getMerchantByUserId(req.session.user.id);
        const instruments = db.prepare(`
            SELECT inst.* 
            FROM instruments inst
            WHERE inst.merchant_id = ?
            ORDER BY inst.id DESC
        `).all(merchant.id);

        if (instruments.length === 0) {
            req.flash('info', 'Please add at least one weighing/measuring instrument before applying for verification.');
            return res.redirect('/merchant/instruments/new');
        }

        res.render('merchant/new-application', {
            title: 'New Verification Application - MetroVerify',
            instruments,
            merchant
        });
    } catch (err) {
        console.error('New Application Form Error:', err);
        req.flash('error', 'Error opening application form.');
        res.redirect('/merchant/applications');
    }
}

/**
 * Submit New Application
 */
function postNewApplication(req, res) {
    try {
        const merchant = getMerchantByUserId(req.session.user.id);
        const { type, preferred_date, mode, instruments: selectedInstruments } = req.body;

        const errors = [];
        if (!type || !['Initial Verification', 'Re-verification'].includes(type)) {
            errors.push('Please select a valid application type.');
        }

        if (!preferred_date) {
            errors.push('Preferred appointment date is required.');
        } else {
            const prefDate = new Date(preferred_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (prefDate < today) {
                errors.push('Preferred date cannot be in the past.');
            }
        }

        if (!mode || !['In-person', 'Remote'].includes(mode)) {
            errors.push('Verification mode must be either In-person or Remote.');
        }

        let instIds = [];
        if (Array.isArray(selectedInstruments)) {
            instIds = selectedInstruments.map(id => parseInt(id, 10));
        } else if (selectedInstruments) {
            instIds = [parseInt(selectedInstruments, 10)];
        }

        if (instIds.length === 0) {
            errors.push('Please select at least one instrument for verification.');
        }

        if (!req.file) {
            errors.push('Please upload a supporting document (invoice or previous verification certificate).');
        }

        if (errors.length > 0) {
            // Remove uploaded file if validation failed
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            req.flash('error', errors.join(' '));
            return res.redirect('/merchant/applications/new');
        }

        // Verify selected instruments belong to merchant
        const placeholders = instIds.map(() => '?').join(',');
        const verifiedInsts = db.prepare(`SELECT id FROM instruments WHERE id IN (${placeholders}) AND merchant_id = ?`).all(...instIds, merchant.id);
        if (verifiedInsts.length !== instIds.length) {
            if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            req.flash('error', 'One or more selected instruments are invalid.');
            return res.redirect('/merchant/applications/new');
        }

        // Generate application number
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const stateCode = (merchant.state || 'DL').substring(0, 2).toUpperCase();
        const appNo = `APP-2026-${stateCode}-${randomNum}`;

        const relativeDocPath = `/uploads/documents/${path.basename(req.file.path)}`;

        // Transactional insert
        const createTx = db.transaction(() => {
            const appStmt = db.prepare(`
                INSERT INTO applications (application_no, merchant_id, type, preferred_date, mode, document_path, document_name, status, submitted_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'Submitted', datetime('now', 'localtime'))
            `);
            const appRes = appStmt.run(appNo, merchant.id, type, preferred_date, mode, relativeDocPath, req.file.originalname);
            const applicationId = appRes.lastInsertRowid;

            const itemStmt = db.prepare(`
                INSERT INTO application_items (application_id, instrument_id)
                VALUES (?, ?)
            `);
            for (const id of instIds) {
                itemStmt.run(applicationId, id);
            }

            return { applicationId, appNo };
        });

        const created = createTx();

        // Audit & Notification
        auditService.logAction(req.session.user.id, 'SUBMIT_APPLICATION', 'applications', created.applicationId, `Submitted application ${created.appNo} with ${instIds.length} instruments`, req);

        notificationService.sendNotification(
            req.session.user.id,
            'Application Submitted',
            `Your verification application ${created.appNo} for ${instIds.length} instrument(s) has been submitted successfully to the Legal Metrology Department.`,
            'SMS'
        );
        notificationService.sendNotification(
            req.session.user.id,
            'Application Confirmation - ' + created.appNo,
            `Your application has been logged under jurisdiction ${merchant.district}. An inspecting officer will review your documents and schedule an inspection shortly.`,
            'Email'
        );

        req.flash('success', `Application ${created.appNo} submitted successfully!`);
        res.redirect(`/merchant/applications/${created.applicationId}`);

    } catch (err) {
        console.error('Submit Application Error:', err);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        req.flash('error', 'Error submitting verification application.');
        res.redirect('/merchant/applications/new');
    }
}

/**
 * Application Detail & Visual Tracker
 */
function getApplicationDetail(req, res) {
    try {
        const merchant = getMerchantByUserId(req.session.user.id);
        const appId = req.params.id;

        const application = db.prepare(`
            SELECT app.*, m.business_name, m.gstin, m.district, m.state
            FROM applications app
            JOIN merchants m ON app.merchant_id = m.id
            WHERE app.id = ? AND app.merchant_id = ?
        `).get(appId, merchant.id);

        if (!application) {
            req.flash('error', 'Application not found.');
            return res.redirect('/merchant/applications');
        }

        // Instruments in this application
        const items = db.prepare(`
            SELECT ai.id as item_id, inst.*,
                   vr.result as test_result, vr.max_error, vr.tolerance_limit, vr.readings_json,
                   c.cert_no, c.valid_until, c.status as cert_status, c.pdf_path
            FROM application_items ai
            JOIN instruments inst ON ai.instrument_id = inst.id
            LEFT JOIN verification_reports vr ON vr.application_item_id = ai.id
            LEFT JOIN certificates c ON c.application_item_id = ai.id
            WHERE ai.application_id = ?
        `).all(appId);

        // Appointment if scheduled
        const appointment = db.prepare(`
            SELECT appt.*, insp_user.name as inspector_name, insp.employee_id, insp.district as inspector_district
            FROM appointments appt
            JOIN inspectors insp ON appt.inspector_id = insp.id
            JOIN users insp_user ON insp.user_id = insp_user.id
            WHERE appt.application_id = ?
            ORDER BY appt.id DESC LIMIT 1
        `).get(appId);

        res.render('merchant/application-detail', {
            title: `Application ${application.application_no} - MetroVerify`,
            application,
            items,
            appointment,
            merchant
        });

    } catch (err) {
        console.error('Get Application Detail Error:', err);
        req.flash('error', 'Error loading application tracker.');
        res.redirect('/merchant/applications');
    }
}

/**
 * List Merchant Certificates
 */
async function getCertificates(req, res) {
    try {
        const merchant = getMerchantByUserId(req.session.user.id);
        const certificates = db.prepare(`
            SELECT c.*, inst.type as instrument_type, inst.serial_no, inst.make_model,
                   app.application_no, insp_user.name as inspector_name
            FROM certificates c
            JOIN application_items ai ON c.application_item_id = ai.id
            JOIN instruments inst ON ai.instrument_id = inst.id
            JOIN applications app ON ai.application_id = app.id
            LEFT JOIN verification_reports vr ON vr.application_item_id = ai.id
            LEFT JOIN inspectors insp ON vr.inspector_id = insp.id
            LEFT JOIN users insp_user ON insp.user_id = insp_user.id
            WHERE inst.merchant_id = ?
            ORDER BY c.id DESC
        `).all(merchant.id);

        const hostUrl = `${req.protocol}://${req.get('host')}`;
        for (const cert of certificates) {
            cert.qrDataUrl = await qrService.generateQRDataURL(`${hostUrl}/verify/${cert.cert_no}`);
        }

        res.render('merchant/certificates', {
            title: 'My Verification Certificates - MetroVerify',
            certificates,
            merchant
        });
    } catch (err) {
        console.error('List Certificates Error:', err);
        req.flash('error', 'Error loading certificates.');
        res.redirect('/merchant/dashboard');
    }
}

module.exports = {
    getDashboard,
    getInstruments,
    getInstrumentForm,
    postInstrument,
    deleteInstrument,
    getApplications,
    getNewApplication,
    postNewApplication,
    getApplicationDetail,
    getCertificates
};
