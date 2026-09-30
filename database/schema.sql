-- MetroVerify - Legal Metrology Online Verification System
-- Database Schema (PostgreSQL, MySQL, and SQLite compatible)

PRAGMA foreign_keys = ON;

-- Users table (Merchants, Inspectors, Admins)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL CHECK(role IN ('merchant', 'inspector', 'admin')),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Merchant Profile
CREATE TABLE IF NOT EXISTS merchants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    business_name TEXT NOT NULL,
    gstin TEXT NOT NULL,
    address TEXT NOT NULL,
    district TEXT NOT NULL,
    state TEXT NOT NULL,
    pincode TEXT NOT NULL,
    mobile TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Inspector Profile
CREATE TABLE IF NOT EXISTS inspectors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    employee_id TEXT UNIQUE NOT NULL,
    district TEXT NOT NULL,
    designation TEXT DEFAULT 'Inspector of Legal Metrology',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Weighing and Measuring Instruments
CREATE TABLE IF NOT EXISTS instruments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    merchant_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    make_model TEXT NOT NULL,
    serial_no TEXT UNIQUE NOT NULL,
    max_capacity REAL NOT NULL,
    min_capacity REAL NOT NULL,
    capacity_unit TEXT DEFAULT 'kg',
    accuracy_class TEXT NOT NULL CHECK(accuracy_class IN ('Class I', 'Class II', 'Class III', 'Class IIII')),
    e_value REAL NOT NULL,
    year_of_manufacture INTEGER NOT NULL,
    location TEXT NOT NULL,
    status TEXT DEFAULT 'registered',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

-- Verification Applications
CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_no TEXT UNIQUE NOT NULL,
    merchant_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('Initial Verification', 'Re-verification')),
    preferred_date DATE NOT NULL,
    mode TEXT NOT NULL CHECK(mode IN ('In-person', 'Remote')),
    document_path TEXT NOT NULL,
    document_name TEXT,
    status TEXT NOT NULL DEFAULT 'Submitted' CHECK(status IN ('Submitted', 'Under Review', 'Scheduled', 'Verified', 'Rejected', 'Certificate Issued')),
    remarks TEXT,
    inspector_notes TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

-- Application Instruments Junction
CREATE TABLE IF NOT EXISTS application_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL,
    instrument_id INTEGER NOT NULL,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
    FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE
);

-- Inspector Appointments
CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL,
    inspector_id INTEGER NOT NULL,
    scheduled_at DATETIME NOT NULL,
    mode TEXT NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'Scheduled' CHECK(status IN ('Scheduled', 'Completed', 'Cancelled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
    FOREIGN KEY (inspector_id) REFERENCES inspectors(id) ON DELETE CASCADE
);

-- Verification Reports & Test Data
CREATE TABLE IF NOT EXISTS verification_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_item_id INTEGER NOT NULL,
    inspector_id INTEGER NOT NULL,
    readings_json TEXT NOT NULL,
    max_error REAL NOT NULL,
    tolerance_limit REAL NOT NULL,
    result TEXT NOT NULL CHECK(result IN ('pass', 'fail')),
    remarks TEXT,
    tested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_item_id) REFERENCES application_items(id) ON DELETE CASCADE,
    FOREIGN KEY (inspector_id) REFERENCES inspectors(id) ON DELETE CASCADE
);

-- Digital Certificates
CREATE TABLE IF NOT EXISTS certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cert_no TEXT UNIQUE NOT NULL,
    application_item_id INTEGER NOT NULL,
    issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    valid_until DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'valid' CHECK(status IN ('valid', 'revoked', 'expired')),
    revocation_reason TEXT,
    revoked_at DATETIME,
    revoked_by INTEGER,
    pdf_path TEXT NOT NULL,
    qr_data TEXT,
    FOREIGN KEY (application_item_id) REFERENCES application_items(id) ON DELETE CASCADE,
    FOREIGN KEY (revoked_by) REFERENCES inspectors(id) ON DELETE SET NULL
);

-- Comprehensive Audit Trail
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    ip_address TEXT,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- In-app Notifications (Simulating SMS & Email)
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    channel TEXT NOT NULL CHECK(channel IN ('SMS', 'Email', 'System')),
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_merchants_gstin ON merchants(gstin);
CREATE INDEX IF NOT EXISTS idx_instruments_serial ON instruments(serial_no);
CREATE INDEX IF NOT EXISTS idx_instruments_merchant ON instruments(merchant_id);
CREATE INDEX IF NOT EXISTS idx_applications_merchant ON applications(merchant_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_certificates_cert_no ON certificates(cert_no);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
