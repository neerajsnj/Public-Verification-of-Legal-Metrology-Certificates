const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const pdfService = require('../services/pdfService');

async function seed() {
    console.log('--- Starting MetroVerify Database Seeding ---');

    // Clean existing tables
    db.exec(`
        DELETE FROM notifications;
        DELETE FROM audit_log;
        DELETE FROM certificates;
        DELETE FROM verification_reports;
        DELETE FROM appointments;
        DELETE FROM application_items;
        DELETE FROM applications;
        DELETE FROM instruments;
        DELETE FROM inspectors;
        DELETE FROM merchants;
        DELETE FROM users;
    `);

    console.log('Cleared existing tables.');

    const defaultPasswordHash = bcrypt.hashSync('Demo@123', 10);

    // 1. Create Users
    const userStmt = db.prepare(`
        INSERT INTO users (role, name, email, password_hash, created_at)
        VALUES (?, ?, ?, ?, datetime('now', '-30 days'))
    `);

    // Merchant 1 (Demo)
    const m1User = userStmt.run('merchant', 'Rajesh Sharma', 'merchant@demo.com', defaultPasswordHash);
    // Merchant 2
    const m2User = userStmt.run('merchant', 'Sunita Patil', 'merchant2@demo.com', defaultPasswordHash);
    // Merchant 3
    const m3User = userStmt.run('merchant', 'Harpreet Singh', 'merchant3@demo.com', defaultPasswordHash);

    // Inspector 1 (Demo) - Central Delhi
    const i1User = userStmt.run('inspector', 'Vikramaditya Roy', 'inspector@demo.com', defaultPasswordHash);
    // Inspector 2 - Mumbai Suburban
    const i2User = userStmt.run('inspector', 'Meenakshi Iyer', 'inspector2@demo.com', defaultPasswordHash);

    console.log('Users created.');

    // 2. Create Merchants
    const merchStmt = db.prepare(`
        INSERT INTO merchants (user_id, business_name, gstin, address, district, state, pincode, mobile)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const m1 = merchStmt.run(
        m1User.lastInsertRowid,
        'Sharma Kirana & Wholesale Mart',
        '07AAAAA1234A1Z5',
        'Shop 14-16, Main Market, Chandni Chowk',
        'Central Delhi',
        'Delhi',
        '110006',
        '9811223344'
    );

    const m2 = merchStmt.run(
        m2User.lastInsertRowid,
        'Patil Jewellers & Bullion Traders',
        '27BBBBB5678B1Z2',
        'Plot 42, Zaveri Bazaar, Kalbadevi',
        'Mumbai Suburban',
        'Maharashtra',
        '400002',
        '9822334455'
    );

    const m3 = merchStmt.run(
        m3User.lastInsertRowid,
        'Punjab Agro Fuel & Freight Station',
        '03CCCCC9012C1Z8',
        'GT Road, Mile Stone 118, Singhu Border',
        'North Delhi',
        'Delhi',
        '110040',
        '9833445566'
    );

    console.log('Merchants created.');

    // 3. Create Inspectors
    const inspStmt = db.prepare(`
        INSERT INTO inspectors (user_id, employee_id, district, designation)
        VALUES (?, ?, ?, ?)
    `);

    const insp1 = inspStmt.run(
        i1User.lastInsertRowid,
        'LM-DL-2018-042',
        'Central Delhi',
        'Senior Inspector of Legal Metrology'
    );

    const insp2 = inspStmt.run(
        i2User.lastInsertRowid,
        'LM-MH-2020-109',
        'Mumbai Suburban',
        'Inspector of Legal Metrology'
    );

    console.log('Inspectors created.');

    // 4. Create 10 Instruments
    const instStmt = db.prepare(`
        INSERT INTO instruments (merchant_id, type, make_model, serial_no, max_capacity, min_capacity, capacity_unit, accuracy_class, e_value, year_of_manufacture, location, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-25 days'))
    `);

    // Merchant 1 instruments (Retail & Grocery)
    const inst1 = instStmt.run(m1.lastInsertRowid, 'Electronic Weighing Scale', 'Essae Teraoka DS-215', 'ESS-2023-8841', 30.0, 0.1, 'kg', 'Class III', 5.0, 2023, 'Billing Counter 1', 'verified');
    const inst2 = instStmt.run(m1.lastInsertRowid, 'Platform Scale', 'Crown Precision CP-300', 'CRW-2022-9912', 300.0, 2.0, 'kg', 'Class III', 50.0, 2022, 'Grain Receiving Bay', 'verified');
    const inst3 = instStmt.run(m1.lastInsertRowid, 'Counter Scale', 'Avery India AT-50', 'AVY-2024-1102', 15.0, 0.05, 'kg', 'Class III', 2.0, 2024, 'Spices Section', 'registered');
    const inst4 = instStmt.run(m1.lastInsertRowid, 'Weights', 'National Standards Cast Iron 5kg-20kg', 'NSI-WT-2021-08', 20.0, 1.0, 'kg', 'Class III', 1.0, 2021, 'Storage Room', 'registered');

    // Merchant 2 instruments (Jewelry & Precision)
    const inst5 = instStmt.run(m2.lastInsertRowid, 'Electronic Weighing Scale', 'Sartorius Gold Series GK-600', 'SAR-GLD-7721', 600.0, 0.01, 'g', 'Class II', 0.01, 2024, 'Diamond Display Counter', 'verified');
    const inst6 = instStmt.run(m2.lastInsertRowid, 'Electronic Weighing Scale', 'Mettler Toledo JL-1502', 'MT-2023-4419', 1500.0, 0.1, 'g', 'Class II', 0.1, 2023, 'Bullion Vault Table', 'registered');
    const inst7 = instStmt.run(m2.lastInsertRowid, 'Spring Balance', 'Salter Heavy Scale SB-10', 'SLT-2022-3030', 50.0, 1.0, 'kg', 'Class IIII', 100.0, 2022, 'Scrap Sorting Bench', 'registered');

    // Merchant 3 instruments (Agro, Heavy & Fuel)
    const inst8 = instStmt.run(m3.lastInsertRowid, 'Weighbridge', 'Avery Weigh-Tronix BridgeMaster 60T', 'AWT-WB-2022-005', 60.0, 0.5, 'ton', 'Class III', 10.0, 2022, 'Entry Gate Weighbridge', 'verified');
    const inst9 = instStmt.run(m3.lastInsertRowid, 'Fuel Dispenser', 'Gilbarco Veeder-Root SK700', 'GVR-FD-2023-712', 80.0, 2.0, 'L', 'Class III', 0.05, 2023, 'Diesel Pump Bay 2', 'registered');
    const inst10 = instStmt.run(m3.lastInsertRowid, 'Liquid Measure', 'Standard Conical Brass 10L', 'LQM-BR-2021-19', 10.0, 1.0, 'L', 'Class III', 0.01, 2021, 'Lube Oil Station', 'registered');

    console.log('10 Instruments created.');

    // Ensure sample dummy supporting document exists
    const docsDir = path.join(__dirname, '../uploads/documents');
    const dummyDocPath = path.join(docsDir, 'sample-invoice.pdf');
    if (!fs.existsSync(dummyDocPath)) {
        fs.writeFileSync(dummyDocPath, '%PDF-1.4 Legal Metrology Sample Invoice and Purchase Bill Document');
    }

    // 5. Create 6 Applications in different statuses
    const appStmt = db.prepare(`
        INSERT INTO applications (application_no, merchant_id, type, preferred_date, mode, document_path, document_name, status, remarks, inspector_notes, submitted_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?), datetime('now', ?))
    `);

    const itemStmt = db.prepare(`
        INSERT INTO application_items (application_id, instrument_id)
        VALUES (?, ?)
    `);

    // App 1: Status = 'Certificate Issued' (Merchant 1, Essae Scale)
    const app1 = appStmt.run(
        'APP-2026-DL-1001',
        m1.lastInsertRowid,
        'Initial Verification',
        '2026-02-15',
        'In-person',
        '/uploads/documents/sample-invoice.pdf',
        'Tax_Invoice_ESSAE_DS215.pdf',
        'Certificate Issued',
        'All calibration tests passed within tolerance.',
        'Verified at laboratory with 20kg class F2 weights.',
        '-20 days',
        '-18 days'
    );
    itemStmt.run(app1.lastInsertRowid, inst1.lastInsertRowid);

    // App 2: Status = 'Certificate Issued' (Expiring Soon - Merchant 2, Sartorius Gold)
    const app2 = appStmt.run(
        'APP-2026-MH-1002',
        m2.lastInsertRowid,
        'Re-verification',
        '2025-10-15',
        'In-person',
        '/uploads/documents/sample-invoice.pdf',
        'Previous_Verification_Cert_2024.pdf',
        'Certificate Issued',
        'Annual re-verification completed.',
        'Precision tests verified with class E2 standard weights.',
        '-350 days',
        '-345 days'
    );
    itemStmt.run(app2.lastInsertRowid, inst5.lastInsertRowid);

    // App 3: Status = 'Certificate Issued' -> BUT WILL BE REVOKED (Merchant 3, Weighbridge)
    const app3 = appStmt.run(
        'APP-2026-DL-1003',
        m3.lastInsertRowid,
        'Initial Verification',
        '2026-01-10',
        'In-person',
        '/uploads/documents/sample-invoice.pdf',
        'Weighbridge_Civil_Foundation_Cert.pdf',
        'Certificate Issued',
        'Initial calibration passed on site.',
        'Heavy test vehicle applied.',
        '-40 days',
        '-38 days'
    );
    itemStmt.run(app3.lastInsertRowid, inst8.lastInsertRowid);

    // App 4: Status = 'Scheduled' (Merchant 1, Platform Scale)
    const app4 = appStmt.run(
        'APP-2026-DL-1004',
        m1.lastInsertRowid,
        'Re-verification',
        '2026-10-12',
        'In-person',
        '/uploads/documents/sample-invoice.pdf',
        'Crown_Scale_Purchase_Bill.pdf',
        'Scheduled',
        'Appointment fixed for on-site inspection.',
        'Ensure 300kg test weights are accessible at the receiving bay.',
        '-5 days',
        '-2 days'
    );
    itemStmt.run(app4.lastInsertRowid, inst2.lastInsertRowid);

    // Create appointment for App 4
    db.prepare(`
        INSERT INTO appointments (application_id, inspector_id, scheduled_at, mode, notes, status, created_at)
        VALUES (?, ?, datetime('now', '+3 days', '10:30'), 'In-person', 'On-site verification of Crown 300kg platform scale. Merchant to keep test weights ready.', 'Scheduled', datetime('now', '-2 days'))
    `).run(app4.lastInsertRowid, insp1.lastInsertRowid);

    // App 5: Status = 'Under Review' (Merchant 2, Mettler Toledo Scale)
    const app5 = appStmt.run(
        'APP-2026-MH-1005',
        m2.lastInsertRowid,
        'Initial Verification',
        '2026-10-15',
        'In-person',
        '/uploads/documents/sample-invoice.pdf',
        'Mettler_Invoice_Warranty.pdf',
        'Under Review',
        'Please upload clear photograph of the manufacturer serial plate showing model approval number.',
        'Serial plate unclear on page 2.',
        '-3 days',
        '-1 days'
    );
    itemStmt.run(app5.lastInsertRowid, inst6.lastInsertRowid);

    // App 6: Status = 'Submitted' (Merchant 3, Fuel Dispenser)
    const app6 = appStmt.run(
        'APP-2026-DL-1006',
        m3.lastInsertRowid,
        'Initial Verification',
        '2026-10-20',
        'In-person',
        '/uploads/documents/sample-invoice.pdf',
        'Gilbarco_Dispenser_Installation_Report.pdf',
        'Submitted',
        'Awaiting queue assignment.',
        null,
        '-1 days',
        '-1 days'
    );
    itemStmt.run(app6.lastInsertRowid, inst9.lastInsertRowid);

    console.log('6 Applications created across different statuses.');

    // 6. Verification Reports & Certificates
    // Certificate 1: VALID (Essae Scale - DL)
    const cert1No = 'LM-2026-DL-104920';
    const readings1 = JSON.stringify([
        { nominalLoad: 5.0, observedReading: 5.000, error: 0.000, tolerance: 5.0, pass: true },
        { nominalLoad: 15.0, observedReading: 15.002, error: 0.002, tolerance: 5.0, pass: true },
        { nominalLoad: 30.0, observedReading: 29.998, error: -0.002, tolerance: 7.5, pass: true }
    ]);

    db.prepare(`
        INSERT INTO verification_reports (application_item_id, inspector_id, readings_json, max_error, tolerance_limit, result, remarks, tested_at)
        VALUES (?, ?, ?, 0.002, 5.0, 'pass', 'Instrument verified and stamped under Legal Metrology Rules, 2011. Conforms to Class III standards.', datetime('now', '-18 days'))
    `).run(1, insp1.lastInsertRowid, readings1);

    // Generate PDF 1
    const cert1Data = {
        cert_no: cert1No,
        app_type: 'Initial Verification',
        application_no: 'APP-2026-DL-1001',
        issued_at: new Date(Date.now() - 18 * 24 * 3600 * 1000),
        valid_until: new Date(Date.now() + 347 * 24 * 3600 * 1000).toISOString().split('T')[0],
        business_name: 'Sharma Kirana & Wholesale Mart',
        merchant_name: 'Rajesh Sharma',
        gstin: '07AAAAA1234A1Z5',
        address: 'Shop 14-16, Main Market, Chandni Chowk',
        district: 'Central Delhi',
        state: 'Delhi',
        pincode: '110006',
        type: 'Electronic Weighing Scale',
        make_model: 'Essae Teraoka DS-215',
        serial_no: 'ESS-2023-8841',
        max_capacity: 30.0,
        min_capacity: 0.1,
        capacity_unit: 'kg',
        accuracy_class: 'Class III',
        e_value: 5.0,
        year_of_manufacture: 2023,
        location: 'Billing Counter 1',
        max_error: 0.002,
        tolerance_limit: 5.0,
        inspector_name: 'Vikramaditya Roy',
        inspector_designation: 'Senior Inspector of Legal Metrology',
        employee_id: 'LM-DL-2018-042'
    };
    const pdf1Path = await pdfService.generateCertificatePDF(cert1Data, 'http://localhost:3000');

    db.prepare(`
        INSERT INTO certificates (cert_no, application_item_id, issued_at, valid_until, status, pdf_path, qr_data)
        VALUES (?, 1, datetime('now', '-18 days'), date('now', '+347 days'), 'valid', ?, ?)
    `).run(cert1No, pdf1Path, `http://localhost:3000/verify/${cert1No}`);

    // Certificate 2: EXPIRING SOON (within 20 days) (Merchant 2, Sartorius Scale)
    const cert2No = 'LM-2025-MH-084219';
    const readings2 = JSON.stringify([
        { nominalLoad: 100.0, observedReading: 100.005, error: 0.005, tolerance: 0.01, pass: true },
        { nominalLoad: 300.0, observedReading: 300.008, error: 0.008, tolerance: 0.02, pass: true },
        { nominalLoad: 600.0, observedReading: 599.992, error: -0.008, tolerance: 0.02, pass: true }
    ]);

    db.prepare(`
        INSERT INTO verification_reports (application_item_id, inspector_id, readings_json, max_error, tolerance_limit, result, remarks, tested_at)
        VALUES (?, ?, ?, 0.008, 0.01, 'pass', 'High-precision balance verified for bullion trade.', datetime('now', '-345 days'))
    `).run(2, insp2.lastInsertRowid, readings2);

    const cert2Data = {
        cert_no: cert2No,
        app_type: 'Re-verification',
        application_no: 'APP-2026-MH-1002',
        issued_at: new Date(Date.now() - 345 * 24 * 3600 * 1000),
        valid_until: new Date(Date.now() + 20 * 24 * 3600 * 1000).toISOString().split('T')[0],
        business_name: 'Patil Jewellers & Bullion Traders',
        merchant_name: 'Sunita Patil',
        gstin: '27BBBBB5678B1Z2',
        address: 'Plot 42, Zaveri Bazaar, Kalbadevi',
        district: 'Mumbai Suburban',
        state: 'Maharashtra',
        pincode: '400002',
        type: 'Electronic Weighing Scale',
        make_model: 'Sartorius Gold Series GK-600',
        serial_no: 'SAR-GLD-7721',
        max_capacity: 600.0,
        min_capacity: 0.01,
        capacity_unit: 'g',
        accuracy_class: 'Class II',
        e_value: 0.01,
        year_of_manufacture: 2024,
        location: 'Diamond Display Counter',
        max_error: 0.008,
        tolerance_limit: 0.01,
        inspector_name: 'Meenakshi Iyer',
        inspector_designation: 'Inspector of Legal Metrology',
        employee_id: 'LM-MH-2020-109'
    };
    const pdf2Path = await pdfService.generateCertificatePDF(cert2Data, 'http://localhost:3000');

    db.prepare(`
        INSERT INTO certificates (cert_no, application_item_id, issued_at, valid_until, status, pdf_path, qr_data)
        VALUES (?, 2, datetime('now', '-345 days'), date('now', '+20 days'), 'valid', ?, ?)
    `).run(cert2No, pdf2Path, `http://localhost:3000/verify/${cert2No}`);

    // Certificate 3: REVOKED (Merchant 3, Weighbridge)
    const cert3No = 'LM-2026-DL-002158';
    const readings3 = JSON.stringify([
        { nominalLoad: 20.0, observedReading: 20.01, error: 0.01, tolerance: 0.02, pass: true },
        { nominalLoad: 40.0, observedReading: 40.02, error: 0.02, tolerance: 0.03, pass: true }
    ]);

    db.prepare(`
        INSERT INTO verification_reports (application_item_id, inspector_id, readings_json, max_error, tolerance_limit, result, remarks, tested_at)
        VALUES (?, ?, ?, 0.02, 0.02, 'pass', 'Verified with calibrated axle test lorry.', datetime('now', '-38 days'))
    `).run(3, insp1.lastInsertRowid, readings3);

    const cert3Data = {
        cert_no: cert3No,
        app_type: 'Initial Verification',
        application_no: 'APP-2026-DL-1003',
        issued_at: new Date(Date.now() - 38 * 24 * 3600 * 1000),
        valid_until: new Date(Date.now() + 327 * 24 * 3600 * 1000).toISOString().split('T')[0],
        business_name: 'Punjab Agro Fuel & Freight Station',
        merchant_name: 'Harpreet Singh',
        gstin: '03CCCCC9012C1Z8',
        address: 'GT Road, Mile Stone 118, Singhu Border',
        district: 'North Delhi',
        state: 'Delhi',
        pincode: '110040',
        type: 'Weighbridge',
        make_model: 'Avery Weigh-Tronix BridgeMaster 60T',
        serial_no: 'AWT-WB-2022-005',
        max_capacity: 60.0,
        min_capacity: 0.5,
        capacity_unit: 'ton',
        accuracy_class: 'Class III',
        e_value: 10.0,
        year_of_manufacture: 2022,
        location: 'Entry Gate Weighbridge',
        max_error: 0.02,
        tolerance_limit: 0.02,
        inspector_name: 'Vikramaditya Roy',
        inspector_designation: 'Senior Inspector of Legal Metrology',
        employee_id: 'LM-DL-2018-042'
    };
    const pdf3Path = await pdfService.generateCertificatePDF(cert3Data, 'http://localhost:3000');

    db.prepare(`
        INSERT INTO certificates (cert_no, application_item_id, issued_at, valid_until, status, revocation_reason, revoked_at, revoked_by, pdf_path, qr_data)
        VALUES (?, 3, datetime('now', '-38 days'), date('now', '+327 days'), 'revoked', ?, datetime('now', '-3 days'), ?, ?, ?)
    `).run(
        cert3No,
        'Official inspection on surprise raid revealed physical lead seal broken and junction box load-cell sensitivity altered by 340 kg in violation of Section 24 & 44 of Legal Metrology Act, 2009.',
        insp1.lastInsertRowid,
        pdf3Path,
        `http://localhost:3000/verify/${cert3No}`
    );

    console.log('3 Certificates created (1 valid, 1 expiring soon, 1 revoked) with official PDFs generated.');

    // 7. Seed In-app Notifications
    const notifStmt = db.prepare(`
        INSERT INTO notifications (user_id, title, message, channel, is_read, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now', ?))
    `);

    // Merchant 1 notifications
    notifStmt.run(m1User.lastInsertRowid, 'Certificate Issued: LM-2026-DL-104920', 'Your Electronic Weighing Scale (ESS-2023-8841) has been verified. Download your QR-coded certificate.', 'SMS', 1, '-18 days');
    notifStmt.run(m1User.lastInsertRowid, 'Appointment Scheduled', 'Inspection for Application APP-2026-DL-1004 is scheduled for upcoming date. Inspector: Vikramaditya Roy.', 'Email', 0, '-2 days');
    notifStmt.run(m1User.lastInsertRowid, 'Application Confirmation', 'Your verification application APP-2026-DL-1004 for Platform Scale has been submitted.', 'SMS', 1, '-5 days');

    // Merchant 2 notifications
    notifStmt.run(m2User.lastInsertRowid, 'Certificate Expiry Warning', 'Certificate LM-2025-MH-084219 expires in 20 days. Apply for annual re-verification immediately to avoid penalty.', 'SMS', 0, '-2 days');
    notifStmt.run(m2User.lastInsertRowid, 'Information Required: APP-2026-MH-1005', 'Inspector Meenakshi Iyer has requested a clearer photograph of the manufacturer serial plate.', 'Email', 0, '-1 days');

    // Merchant 3 notifications
    notifStmt.run(m3User.lastInsertRowid, 'CRITICAL: Certificate Revoked LM-2026-DL-002158', 'Weighbridge certificate revoked due to lead seal tampering found during surprise raid. Immediate cease-and-desist ordered.', 'SMS', 0, '-3 days');

    // Inspector 1 notifications
    notifStmt.run(i1User.lastInsertRowid, 'New Application Received', 'Merchant Sharma Kirana submitted application APP-2026-DL-1004 for Central Delhi jurisdiction.', 'System', 1, '-5 days');
    notifStmt.run(i1User.lastInsertRowid, 'New Application in Queue', 'Merchant Punjab Agro submitted fuel dispenser application APP-2026-DL-1006.', 'System', 0, '-1 days');

    console.log('Simulated notifications seeded.');

    // 8. Seed Audit Log
    const auditStmt = db.prepare(`
        INSERT INTO audit_log (user_id, action, entity, entity_id, ip_address, details, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now', ?))
    `);

    auditStmt.run(m1User.lastInsertRowid, 'REGISTER_MERCHANT', 'merchants', '1', '127.0.0.1', 'Registered Sharma Kirana & Wholesale Mart (GSTIN: 07AAAAA1234A1Z5)', '-30 days');
    auditStmt.run(m1User.lastInsertRowid, 'ADD_INSTRUMENT', 'instruments', '1', '127.0.0.1', 'Added Electronic Weighing Scale ESS-2023-8841', '-25 days');
    auditStmt.run(m1User.lastInsertRowid, 'SUBMIT_APPLICATION', 'applications', '1', '127.0.0.1', 'Submitted verification application APP-2026-DL-1001', '-20 days');
    auditStmt.run(i1User.lastInsertRowid, 'APPROVE_VERIFICATION', 'certificates', cert1No, '127.0.0.1', `Approved verification and issued certificate ${cert1No}`, '-18 days');
    auditStmt.run(m1User.lastInsertRowid, 'SUBMIT_APPLICATION', 'applications', '4', '127.0.0.1', 'Submitted verification application APP-2026-DL-1004', '-5 days');
    auditStmt.run(i1User.lastInsertRowid, 'SCHEDULE_APPOINTMENT', 'appointments', '1', '127.0.0.1', 'Scheduled verification inspection for APP-2026-DL-1004', '-2 days');
    auditStmt.run(i1User.lastInsertRowid, 'REVOKE_CERTIFICATE', 'certificates', cert3No, '127.0.0.1', `Revoked certificate ${cert3No} due to lead seal tampering`, '-3 days');

    console.log('Audit trail seeded.');
    console.log('--- MetroVerify Database Seeding Completed Successfully! ---');
    console.log('\nDemo Logins:');
    console.log('Merchant:  merchant@demo.com  /  Demo@123');
    console.log('Inspector: inspector@demo.com /  Demo@123');
    console.log('Certificates:');
    console.log('  1. Valid:        LM-2026-DL-104920');
    console.log('  2. Expiring Soon: LM-2025-MH-084219');
    console.log('  3. Revoked:      LM-2026-DL-002158');
}

seed().catch(err => {
    console.error('Seeding failed:', err);
    process.exit(1);
});
