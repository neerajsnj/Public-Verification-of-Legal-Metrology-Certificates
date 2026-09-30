const db = require('../database/db');
const qrService = require('../services/qrService');

/**
 * Public Landing Page
 */
function getLanding(req, res) {
    const lang = req.query.lang === 'hi' ? 'hi' : 'en';

    // Fetch aggregate statistics for the portal dashboard counters
    let stats = {
        totalInstruments: 0,
        verifiedInstruments: 0,
        activeMerchants: 0,
        activeInspectors: 0
    };

    try {
        const instCount = db.prepare('SELECT COUNT(*) as count FROM instruments').get()?.count || 0;
        const certCount = db.prepare("SELECT COUNT(*) as count FROM certificates WHERE status = 'valid'").get()?.count || 0;
        const merchCount = db.prepare('SELECT COUNT(*) as count FROM merchants').get()?.count || 0;
        const inspCount = db.prepare('SELECT COUNT(*) as count FROM inspectors').get()?.count || 0;

        stats = {
            totalInstruments: instCount,
            verifiedInstruments: certCount,
            activeMerchants: merchCount,
            activeInspectors: inspCount
        };
    } catch (err) {
        console.error('Error fetching landing stats:', err);
    }

    res.render('public/index', {
        title: 'MetroVerify - Online Verification System for Weighing & Measuring Instruments',
        stats,
        lang
    });
}

/**
 * Public Verification Page (Search or Direct QR Link)
 */
async function getVerify(req, res) {
    const certNo = (req.params.certNo || req.query.certNo || '').trim();

    if (!certNo) {
        return res.render('public/verify', {
            title: 'Verify Certificate of Verification - Legal Metrology',
            certificate: null,
            searched: false,
            certNo: ''
        });
    }

    try {
        // Query certificate with full joined data
        const certQuery = `
            SELECT 
                c.id as cert_id,
                c.cert_no,
                c.issued_at,
                c.valid_until,
                c.status as cert_status,
                c.revocation_reason,
                c.revoked_at,
                c.pdf_path,
                inst.type as instrument_type,
                inst.make_model,
                inst.serial_no,
                inst.max_capacity,
                inst.min_capacity,
                inst.capacity_unit,
                inst.accuracy_class,
                inst.e_value,
                inst.year_of_manufacture,
                inst.location as instrument_location,
                m.business_name,
                m.gstin,
                m.address as merchant_address,
                m.district as merchant_district,
                m.state as merchant_state,
                m.pincode as merchant_pincode,
                u.name as merchant_name,
                insp_user.name as inspector_name,
                insp.employee_id as inspector_emp_id,
                insp.designation as inspector_designation,
                insp.district as inspector_district,
                vr.readings_json,
                vr.max_error,
                vr.tolerance_limit,
                vr.result as test_result,
                vr.tested_at,
                app.application_no,
                app.type as application_type
            FROM certificates c
            JOIN application_items ai ON c.application_item_id = ai.id
            JOIN instruments inst ON ai.instrument_id = inst.id
            JOIN applications app ON ai.application_id = app.id
            JOIN merchants m ON inst.merchant_id = m.id
            JOIN users u ON m.user_id = u.id
            LEFT JOIN verification_reports vr ON vr.application_item_id = ai.id
            LEFT JOIN inspectors insp ON vr.inspector_id = insp.id
            LEFT JOIN users insp_user ON insp.user_id = insp_user.id
            WHERE UPPER(c.cert_no) = UPPER(?)
            ORDER BY c.id DESC
            LIMIT 1
        `;

        const certificate = db.prepare(certQuery).get(certNo);

        if (!certificate) {
            return res.render('public/verify', {
                title: 'Certificate Not Found - MetroVerify',
                certificate: null,
                searched: true,
                certNo
            });
        }

        // Check if certificate has expired
        const now = new Date();
        const validUntil = new Date(certificate.valid_until);
        let effectiveStatus = certificate.cert_status;

        if (certificate.cert_status === 'valid' && validUntil < now) {
            effectiveStatus = 'expired';
        }

        // Parse readings if available
        let testReadings = [];
        if (certificate.readings_json) {
            try {
                testReadings = JSON.parse(certificate.readings_json);
            } catch (e) {
                testReadings = [];
            }
        }

        // Generate QR code data URL for this verification page
        const hostUrl = `${req.protocol}://${req.get('host')}`;
        const qrDataUrl = await qrService.generateQRDataURL(`${hostUrl}/verify/${certificate.cert_no}`);

        res.render('public/verify', {
            title: `Verify ${certificate.cert_no} - MetroVerify`,
            certificate: {
                ...certificate,
                effectiveStatus,
                testReadings,
                qrDataUrl
            },
            searched: true,
            certNo
        });

    } catch (err) {
        console.error('Verification Lookup Error:', err);
        req.flash('error', 'Error looking up certificate details.');
        res.render('public/verify', {
            title: 'Verify Certificate - MetroVerify',
            certificate: null,
            searched: true,
            certNo
        });
    }
}

module.exports = {
    getLanding,
    getVerify
};
