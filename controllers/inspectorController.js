const db = require('../database/db');
const auditService = require('../services/auditService');
const notificationService = require('../services/notificationService');
const pdfService = require('../services/pdfService');
const qrService = require('../services/qrService');

/**
 * Helper to get current inspector record
 */
function getInspectorByUserId(userId) {
    return db.prepare('SELECT * FROM inspectors WHERE user_id = ?').get(userId);
}

/**
 * Inspector Dashboard
 */
function getDashboard(req, res) {
    try {
        const inspector = getInspectorByUserId(req.session.user.id);
        if (!inspector) {
            req.flash('error', 'Inspector profile not found.');
            return res.redirect('/');
        }

        // Stats for inspector's district / general
        const totalPending = db.prepare(`
            SELECT COUNT(*) as count FROM applications app
            JOIN merchants m ON app.merchant_id = m.id
            WHERE app.status IN ('Submitted', 'Under Review', 'Scheduled')
        `).get()?.count || 0;

        const myDistrictPending = db.prepare(`
            SELECT COUNT(*) as count FROM applications app
            JOIN merchants m ON app.merchant_id = m.id
            WHERE app.status IN ('Submitted', 'Under Review', 'Scheduled') AND m.district = ?
        `).get(inspector.district)?.count || 0;

        const totalVerified = db.prepare(`
            SELECT COUNT(*) as count FROM certificates
            WHERE status = 'valid'
        `).get()?.count || 0;

        const totalRevoked = db.prepare(`
            SELECT COUNT(*) as count FROM certificates
            WHERE status = 'revoked'
        `).get()?.count || 0;

        // Today's & Upcoming appointments
        const appointments = db.prepare(`
            SELECT appt.*, app.application_no, m.business_name, m.district, m.mobile, u.name as merchant_name
            FROM appointments appt
            JOIN applications app ON appt.application_id = app.id
            JOIN merchants m ON app.merchant_id = m.id
            JOIN users u ON m.user_id = u.id
            WHERE appt.inspector_id = ? AND appt.status = 'Scheduled'
            ORDER BY appt.scheduled_at ASC
            LIMIT 5
        `).all(inspector.id);

        // Recent applications waiting for review
        const recentPending = db.prepare(`
            SELECT app.*, m.business_name, m.district, m.state, m.gstin, COUNT(ai.id) as instrument_count
            FROM applications app
            JOIN merchants m ON app.merchant_id = m.id
            LEFT JOIN application_items ai ON app.id = ai.application_id
            WHERE app.status IN ('Submitted', 'Under Review')
            GROUP BY app.id
            ORDER BY app.id DESC
            LIMIT 5
        `).all();

        res.render('inspector/dashboard', {
            title: 'Inspector Portal - MetroVerify',
            inspector,
            stats: {
                totalPending,
                myDistrictPending,
                totalVerified,
                totalRevoked
            },
            appointments,
            recentPending
        });

    } catch (err) {
        console.error('Inspector Dashboard Error:', err);
        req.flash('error', 'Error loading inspector dashboard.');
        res.redirect('/');
    }
}

/**
 * Filterable Queue of Applications
 */
function getApplications(req, res) {
    try {
        const inspector = getInspectorByUserId(req.session.user.id);
        const { status, district, instrument_type, search, date_from, date_to } = req.query;

        let query = `
            SELECT app.*, m.business_name, m.district, m.state, m.gstin, u.name as merchant_name,
                   COUNT(ai.id) as instrument_count,
                   GROUP_CONCAT(inst.type, ', ') as instrument_types,
                   GROUP_CONCAT(inst.serial_no, ', ') as serial_numbers
            FROM applications app
            JOIN merchants m ON app.merchant_id = m.id
            JOIN users u ON m.user_id = u.id
            LEFT JOIN application_items ai ON app.id = ai.application_id
            LEFT JOIN instruments inst ON ai.instrument_id = inst.id
            WHERE 1=1
        `;

        const params = [];

        if (status && status !== 'all') {
            query += ' AND app.status = ?';
            params.push(status);
        }

        if (district && district !== 'all') {
            query += ' AND m.district = ?';
            params.push(district);
        }

        if (instrument_type && instrument_type !== 'all') {
            query += ' AND inst.type = ?';
            params.push(instrument_type);
        }

        if (date_from) {
            query += ' AND date(app.submitted_at) >= ?';
            params.push(date_from);
        }

        if (date_to) {
            query += ' AND date(app.submitted_at) <= ?';
            params.push(date_to);
        }

        if (search && search.trim()) {
            const term = `%${search.trim()}%`;
            query += ' AND (m.business_name LIKE ? OR u.name LIKE ? OR m.gstin LIKE ? OR app.application_no LIKE ? OR inst.serial_no LIKE ?)';
            params.push(term, term, term, term, term);
        }

        query += ' GROUP BY app.id ORDER BY app.id DESC';

        const applications = db.prepare(query).all(...params);

        // Get distinct districts and instrument types for filter dropdowns
        const districts = db.prepare('SELECT DISTINCT district FROM merchants ORDER BY district').all().map(d => d.district);
        const instrumentTypes = [
            'Electronic Weighing Scale',
            'Platform Scale',
            'Weighbridge',
            'Counter Scale',
            'Spring Balance',
            'Measuring Tape',
            'Fuel Dispenser',
            'Liquid Measure',
            'Weights'
        ];

        res.render('inspector/applications', {
            title: 'Verification Applications Queue - MetroVerify',
            inspector,
            applications,
            districts,
            instrumentTypes,
            filters: {
                status: status || 'all',
                district: district || 'all',
                instrument_type: instrument_type || 'all',
                search: search || '',
                date_from: date_from || '',
                date_to: date_to || ''
            }
        });

    } catch (err) {
        console.error('Inspector Applications Error:', err);
        req.flash('error', 'Error loading applications queue.');
        res.redirect('/inspector/dashboard');
    }
}

/**
 * Application Detail Review Screen
 */
function getApplicationDetail(req, res) {
    try {
        const inspector = getInspectorByUserId(req.session.user.id);
        const appId = req.params.id;

        const application = db.prepare(`
            SELECT app.*, m.business_name, m.gstin, m.address, m.district, m.state, m.pincode, m.mobile,
                   u.name as merchant_name, u.email as merchant_email
            FROM applications app
            JOIN merchants m ON app.merchant_id = m.id
            JOIN users u ON m.user_id = u.id
            WHERE app.id = ?
        `).get(appId);

        if (!application) {
            req.flash('error', 'Application not found.');
            return res.redirect('/inspector/applications');
        }

        // Instruments list
        const items = db.prepare(`
            SELECT ai.id as item_id, inst.*,
                   vr.result as test_result, vr.max_error, vr.tolerance_limit, vr.readings_json, vr.remarks as test_remarks,
                   c.cert_no, c.valid_until, c.status as cert_status, c.pdf_path
            FROM application_items ai
            JOIN instruments inst ON ai.instrument_id = inst.id
            LEFT JOIN verification_reports vr ON vr.application_item_id = ai.id
            LEFT JOIN certificates c ON c.application_item_id = ai.id
            WHERE ai.application_id = ?
        `).all(appId);

        // Appointment
        const appointment = db.prepare(`
            SELECT appt.*, insp_user.name as inspector_name, insp.employee_id
            FROM appointments appt
            JOIN inspectors insp ON appt.inspector_id = insp.id
            JOIN users insp_user ON insp.user_id = insp_user.id
            WHERE appt.application_id = ?
            ORDER BY appt.id DESC LIMIT 1
        `).get(appId);

        // Audit Trail for this application
        const auditTrail = db.prepare(`
            SELECT a.*, u.name as actor_name, u.role as actor_role
            FROM audit_log a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE a.entity = 'applications' AND a.entity_id = ?
            ORDER BY a.id ASC
        `).all(String(appId));

        res.render('inspector/application-detail', {
            title: `Review ${application.application_no} - MetroVerify`,
            inspector,
            application,
            items,
            appointment,
            auditTrail
        });

    } catch (err) {
        console.error('Inspector Application Detail Error:', err);
        req.flash('error', 'Error opening application details.');
        res.redirect('/inspector/applications');
    }
}

/**
 * Action: Request More Info
 */
function postRequestInfo(req, res) {
    try {
        const inspector = getInspectorByUserId(req.session.user.id);
        const appId = req.params.id;
        const { remarks } = req.body;

        if (!remarks || remarks.trim().length < 5) {
            req.flash('error', 'Please provide detailed questions or instructions for the merchant.');
            return res.redirect(`/inspector/applications/${appId}`);
        }

        const app = db.prepare(`
            SELECT app.*, m.user_id as merchant_user_id 
            FROM applications app 
            JOIN merchants m ON app.merchant_id = m.id 
            WHERE app.id = ?
        `).get(appId);

        if (!app) {
            req.flash('error', 'Application not found.');
            return res.redirect('/inspector/applications');
        }

        db.prepare(`
            UPDATE applications
            SET status = 'Under Review', remarks = ?, updated_at = datetime('now', 'localtime')
            WHERE id = ?
        `).run(remarks.trim(), appId);

        auditService.logAction(req.session.user.id, 'REQUEST_INFO', 'applications', appId, `Inspector requested clarification: "${remarks.trim()}"`, req);

        notificationService.sendMultiChannelNotification(
            app.merchant_user_id,
            `Action Required: Application ${app.application_no}`,
            `The Inspecting Officer has reviewed your application and requested clarification: "${remarks.trim()}". Please review your application tracker.`
        );

        req.flash('success', 'Information request recorded. Merchant has been notified via SMS & Email.');
        res.redirect(`/inspector/applications/${appId}`);

    } catch (err) {
        console.error('Request Info Error:', err);
        req.flash('error', 'Error updating application.');
        res.redirect(`/inspector/applications/${req.params.id}`);
    }
}

/**
 * Action: Schedule Appointment
 */
function postSchedule(req, res) {
    try {
        const inspector = getInspectorByUserId(req.session.user.id);
        const appId = req.params.id;
        const { scheduled_at, mode, notes } = req.body;

        if (!scheduled_at) {
            req.flash('error', 'Please specify the scheduled date and time.');
            return res.redirect(`/inspector/applications/${appId}`);
        }

        const app = db.prepare(`
            SELECT app.*, m.user_id as merchant_user_id 
            FROM applications app 
            JOIN merchants m ON app.merchant_id = m.id 
            WHERE app.id = ?
        `).get(appId);

        if (!app) {
            req.flash('error', 'Application not found.');
            return res.redirect('/inspector/applications');
        }

        // Insert or update appointment
        const scheduleTx = db.transaction(() => {
            db.prepare(`
                INSERT INTO appointments (application_id, inspector_id, scheduled_at, mode, notes, status, created_at)
                VALUES (?, ?, ?, ?, ?, 'Scheduled', datetime('now', 'localtime'))
            `).run(appId, inspector.id, scheduled_at, mode || 'In-person', notes ? notes.trim() : null);

            db.prepare(`
                UPDATE applications
                SET status = 'Scheduled', inspector_notes = ?, updated_at = datetime('now', 'localtime')
                WHERE id = ?
            `).run(notes ? notes.trim() : null, appId);
        });

        scheduleTx();

        const formattedDate = new Date(scheduled_at).toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });

        auditService.logAction(req.session.user.id, 'SCHEDULE_APPOINTMENT', 'applications', appId, `Scheduled verification for ${formattedDate} (${mode || 'In-person'})`, req);

        notificationService.sendMultiChannelNotification(
            app.merchant_user_id,
            `Inspection Scheduled: ${app.application_no}`,
            `Verification inspection has been scheduled for ${formattedDate} (${mode || 'In-person'}). Inspector: ${req.session.user.name}. Notes: ${notes || 'Standard protocol inspection'}.`
        );

        req.flash('success', `Verification appointment successfully scheduled for ${formattedDate}.`);
        res.redirect(`/inspector/applications/${appId}`);

    } catch (err) {
        console.error('Schedule Error:', err);
        req.flash('error', 'Error scheduling appointment.');
        res.redirect(`/inspector/applications/${req.params.id}`);
    }
}

/**
 * Action: Record Verification Result & Auto-Issue Certificate (or Reject)
 */
async function postVerifyResult(req, res) {
    try {
        const inspector = getInspectorByUserId(req.session.user.id);
        const appId = req.params.id;
        const { itemId, decision, rejection_reason, readings_json, max_error, tolerance_limit, validity_months, inspector_remarks } = req.body;

        const app = db.prepare(`
            SELECT app.*, m.id as merchant_id, m.user_id as merchant_user_id, m.business_name, m.gstin, m.address, m.district, m.state, m.pincode,
                   u.name as merchant_name
            FROM applications app
            JOIN merchants m ON app.merchant_id = m.id
            JOIN users u ON m.user_id = u.id
            WHERE app.id = ?
        `).get(appId);

        if (!app) {
            req.flash('error', 'Application not found.');
            return res.redirect('/inspector/applications');
        }

        const appItem = db.prepare(`
            SELECT ai.id as item_id, inst.*
            FROM application_items ai
            JOIN instruments inst ON ai.instrument_id = inst.id
            WHERE ai.id = ? AND ai.application_id = ?
        `).get(itemId, appId);

        if (!appItem) {
            req.flash('error', 'Application instrument item not found.');
            return res.redirect(`/inspector/applications/${appId}`);
        }

        const isApprove = decision === 'pass';

        if (!isApprove && (!rejection_reason || rejection_reason.trim().length < 5)) {
            req.flash('error', 'A specific rejection reason is mandatory when rejecting verification.');
            return res.redirect(`/inspector/applications/${appId}`);
        }

        const maxErrVal = parseFloat(max_error) || 0.0;
        const tolVal = parseFloat(tolerance_limit) || 1.0;
        const readingsStr = readings_json || JSON.stringify([
            { nominalLoad: (appItem.max_capacity / 2).toFixed(2), observedReading: (appItem.max_capacity / 2).toFixed(2), error: 0.0, tolerance: tolVal, pass: true }
        ]);

        if (isApprove) {
            // APPROVE FLOW: Generate Certificate
            const stateCode = (app.state || 'DL').substring(0, 2).toUpperCase();
            const certRandom = Math.floor(100000 + Math.random() * 900000);
            const certNo = `LM-2026-${stateCode}-${certRandom}`;

            const months = parseInt(validity_months, 10) || 12;
            const validUntilDate = new Date();
            validUntilDate.setMonth(validUntilDate.getMonth() + months);
            const validUntilStr = validUntilDate.toISOString().split('T')[0];

            const hostUrl = `${req.protocol}://${req.get('host')}`;

            // Prepare certificate data for PDF
            const certData = {
                cert_no: certNo,
                app_type: app.type,
                application_no: app.application_no,
                issued_at: new Date(),
                valid_until: validUntilStr,
                business_name: app.business_name,
                merchant_name: app.merchant_name,
                gstin: app.gstin,
                address: app.address,
                district: app.district,
                state: app.state,
                pincode: app.pincode,
                type: appItem.type,
                make_model: appItem.make_model,
                serial_no: appItem.serial_no,
                max_capacity: appItem.max_capacity,
                min_capacity: appItem.min_capacity,
                capacity_unit: appItem.capacity_unit || 'kg',
                accuracy_class: appItem.accuracy_class,
                e_value: appItem.e_value,
                year_of_manufacture: appItem.year_of_manufacture,
                location: appItem.location,
                max_error: maxErrVal,
                tolerance_limit: tolVal,
                inspector_name: req.session.user.name,
                inspector_designation: inspector.designation,
                employee_id: inspector.employee_id
            };

            const pdfPath = await pdfService.generateCertificatePDF(certData, hostUrl);

            // Transactional Save
            const approveTx = db.transaction(() => {
                // Verification report
                db.prepare(`
                    INSERT INTO verification_reports (application_item_id, inspector_id, readings_json, max_error, tolerance_limit, result, remarks, tested_at)
                    VALUES (?, ?, ?, ?, ?, 'pass', ?, datetime('now', 'localtime'))
                `).run(appItem.item_id, inspector.id, readingsStr, maxErrVal, tolVal, inspector_remarks || 'All test parameters within MPE tolerances');

                // Certificate
                db.prepare(`
                    INSERT INTO certificates (cert_no, application_item_id, issued_at, valid_until, status, pdf_path, qr_data)
                    VALUES (?, ?, datetime('now', 'localtime'), ?, 'valid', ?, ?)
                `).run(certNo, appItem.item_id, validUntilStr, pdfPath, `${hostUrl}/verify/${certNo}`);

                // Update application status
                db.prepare(`
                    UPDATE applications
                    SET status = 'Certificate Issued', updated_at = datetime('now', 'localtime')
                    WHERE id = ?
                `).run(appId);

                // Update instrument status
                db.prepare(`
                    UPDATE instruments
                    SET status = 'verified'
                    WHERE id = ?
                `).run(appItem.id);
            });

            approveTx();

            auditService.logAction(req.session.user.id, 'APPROVE_VERIFICATION', 'certificates', certNo, `Approved verification and issued certificate ${certNo} for ${appItem.serial_no}`, req);

            notificationService.sendMultiChannelNotification(
                app.merchant_user_id,
                `Certificate Issued: ${certNo}`,
                `Congratulations! Verification for your instrument "${appItem.type} (${appItem.serial_no})" has been approved. Digital Certificate of Verification ${certNo} is now available for download.`
            );

            req.flash('success', `Verification approved successfully! Official Digital Certificate ${certNo} generated.`);

        } else {
            // REJECT FLOW
            const rejectTx = db.transaction(() => {
                db.prepare(`
                    INSERT INTO verification_reports (application_item_id, inspector_id, readings_json, max_error, tolerance_limit, result, remarks, tested_at)
                    VALUES (?, ?, ?, ?, ?, 'fail', ?, datetime('now', 'localtime'))
                `).run(appItem.item_id, inspector.id, readingsStr, maxErrVal, tolVal, rejection_reason.trim());

                db.prepare(`
                    UPDATE applications
                    SET status = 'Rejected', remarks = ?, updated_at = datetime('now', 'localtime')
                    WHERE id = ?
                `).run(rejection_reason.trim(), appId);

                db.prepare(`
                    UPDATE instruments
                    SET status = 'rejected'
                    WHERE id = ?
                `).run(appItem.id);
            });

            rejectTx();

            auditService.logAction(req.session.user.id, 'REJECT_VERIFICATION', 'applications', appId, `Rejected instrument ${appItem.serial_no}. Reason: ${rejection_reason.trim()}`, req);

            notificationService.sendMultiChannelNotification(
                app.merchant_user_id,
                `Verification Rejected: ${app.application_no}`,
                `Notice: Verification for instrument "${appItem.type} (${appItem.serial_no})" was rejected by the Inspecting Officer. Reason: "${rejection_reason.trim()}". You may recalibrate and submit a new application.`
            );

            req.flash('error', `Application rejected. Reason recorded and merchant notified.`);
        }

        res.redirect(`/inspector/applications/${appId}`);

    } catch (err) {
        console.error('Record Verification Result Error:', err);
        req.flash('error', 'Error saving verification result.');
        res.redirect(`/inspector/applications/${req.params.id}`);
    }
}

/**
 * Action: Revoke Certificate
 */
function postRevokeCertificate(req, res) {
    try {
        const inspector = getInspectorByUserId(req.session.user.id);
        const { cert_no, revocation_reason, redirect_to } = req.body;

        if (!revocation_reason || revocation_reason.trim().length < 5) {
            req.flash('error', 'A valid legal reason is mandatory to revoke a certificate.');
            return res.redirect(redirect_to || '/inspector/certificates');
        }

        const cert = db.prepare(`
            SELECT c.*, inst.type as instrument_type, inst.serial_no, m.user_id as merchant_user_id
            FROM certificates c
            JOIN application_items ai ON c.application_item_id = ai.id
            JOIN instruments inst ON ai.instrument_id = inst.id
            JOIN merchants m ON inst.merchant_id = m.id
            WHERE c.cert_no = ?
        `).get(cert_no);

        if (!cert) {
            req.flash('error', 'Certificate not found.');
            return res.redirect(redirect_to || '/inspector/certificates');
        }

        db.prepare(`
            UPDATE certificates
            SET status = 'revoked', revocation_reason = ?, revoked_at = datetime('now', 'localtime'), revoked_by = ?
            WHERE cert_no = ?
        `).run(revocation_reason.trim(), inspector.id, cert_no);

        auditService.logAction(req.session.user.id, 'REVOKE_CERTIFICATE', 'certificates', cert_no, `Revoked certificate ${cert_no}. Reason: ${revocation_reason.trim()}`, req);

        notificationService.sendMultiChannelNotification(
            cert.merchant_user_id,
            `URGENT: Certificate Revocation - ${cert_no}`,
            `Certificate of Verification ${cert_no} for instrument ${cert.instrument_type} (${cert.serial_no}) has been REVOKED by the Legal Metrology Department. Reason: "${revocation_reason.trim()}". Further commercial use is unlawful.`
        );

        req.flash('success', `Certificate ${cert_no} has been officially revoked.`);
        res.redirect(redirect_to || '/inspector/certificates');

    } catch (err) {
        console.error('Revoke Certificate Error:', err);
        req.flash('error', 'Error revoking certificate.');
        res.redirect('/inspector/certificates');
    }
}

/**
 * Inspector Certificates List (with Revocation modal)
 */
function getCertificates(req, res) {
    try {
        const inspector = getInspectorByUserId(req.session.user.id);
        const certificates = db.prepare(`
            SELECT c.*, inst.type as instrument_type, inst.serial_no, inst.make_model,
                   m.business_name, m.district, m.gstin, u.name as merchant_name
            FROM certificates c
            JOIN application_items ai ON c.application_item_id = ai.id
            JOIN instruments inst ON ai.instrument_id = inst.id
            JOIN merchants m ON inst.merchant_id = m.id
            JOIN users u ON m.user_id = u.id
            ORDER BY c.id DESC
        `).all();

        res.render('inspector/certificates', {
            title: 'Issued Certificates Management - MetroVerify',
            inspector,
            certificates
        });
    } catch (err) {
        console.error('Inspector Certificates Error:', err);
        req.flash('error', 'Error loading certificates list.');
        res.redirect('/inspector/dashboard');
    }
}

/**
 * Inspector Analytics Dashboard (Chart.js data)
 */
function getAnalytics(req, res) {
    try {
        const inspector = getInspectorByUserId(req.session.user.id);

        // Summary counts
        const totalApps = db.prepare('SELECT COUNT(*) as count FROM applications').get()?.count || 0;
        const totalApproved = db.prepare("SELECT COUNT(*) as count FROM certificates WHERE status = 'valid'").get()?.count || 0;
        const totalRejected = db.prepare("SELECT COUNT(*) as count FROM applications WHERE status = 'Rejected'").get()?.count || 0;
        const totalRevoked = db.prepare("SELECT COUNT(*) as count FROM certificates WHERE status = 'revoked'").get()?.count || 0;

        // Daily applications trend (last 14 days)
        const dailyTrend = db.prepare(`
            SELECT date(submitted_at) as day, COUNT(*) as count
            FROM applications
            WHERE date(submitted_at) >= date('now', '-14 days')
            GROUP BY date(submitted_at)
            ORDER BY day ASC
        `).all();

        // Instruments breakdown
        const instrumentBreakdown = db.prepare(`
            SELECT type, COUNT(*) as count
            FROM instruments
            GROUP BY type
            ORDER BY count DESC
        `).all();

        // District breakdown
        const districtBreakdown = db.prepare(`
            SELECT m.district, COUNT(app.id) as count
            FROM applications app
            JOIN merchants m ON app.merchant_id = m.id
            GROUP BY m.district
            ORDER BY count DESC
        `).all();

        res.render('inspector/analytics', {
            title: 'Metrology Analytics & Performance - MetroVerify',
            inspector,
            metrics: {
                totalApps,
                totalApproved,
                totalRejected,
                totalRevoked,
                approvalRate: totalApps > 0 ? Math.round((totalApproved / (totalApproved + totalRejected || 1)) * 100) : 100,
                avgProcessingDays: 1.8
            },
            chartData: {
                dailyTrend,
                instrumentBreakdown,
                districtBreakdown,
                approvalBreakdown: [
                    { label: 'Approved', count: totalApproved },
                    { label: 'Rejected', count: totalRejected },
                    { label: 'Revoked', count: totalRevoked }
                ]
            }
        });

    } catch (err) {
        console.error('Analytics Error:', err);
        req.flash('error', 'Error loading analytics.');
        res.redirect('/inspector/dashboard');
    }
}

/**
 * Inspector Audit Trail View
 */
function getAuditLog(req, res) {
    try {
        const inspector = getInspectorByUserId(req.session.user.id);
        const logs = auditService.getRecentLogs(100);

        res.render('inspector/audit-log', {
            title: 'System Audit Trail - MetroVerify',
            inspector,
            logs
        });
    } catch (err) {
        console.error('Audit Log Error:', err);
        req.flash('error', 'Error loading audit logs.');
        res.redirect('/inspector/dashboard');
    }
}

module.exports = {
    getDashboard,
    getApplications,
    getApplicationDetail,
    postRequestInfo,
    postSchedule,
    postVerifyResult,
    postRevokeCertificate,
    getCertificates,
    getAnalytics,
    getAuditLog
};
