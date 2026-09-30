# MetroVerify - Online Verification System for Weighing & Measuring Instruments

**Smart India Hackathon 2026 | Problem Statement SIH26036**  
*Ministry of Consumer Affairs, Food & Public Distribution — Directorate of Legal Metrology (Weights & Measures Division)*

---

## 🎯 Executive Summary & Problem Context

In commercial trade, fair market transactions, and consumer protection, the calibration accuracy of weighing and measuring instruments (retail scales, weighbridges, fuel dispensers, grain balances) is governed by **Section 24 of The Legal Metrology Act, 2009** and **Legal Metrology (General) Rules, 2011**. 

Historically, the verification workflow relied on cumbersome paper stamping, physical registers, manual dispatch, and lead seals that were vulnerable to tampering and counterfeiting. Consumers and market enforcement squads lacked any instant method to authenticate whether a retail scale was legally verified or counterfeit.

**MetroVerify** digitizes the entire lifecycle into an end-to-end e-governance platform:
1. **Merchants** register equipment inventory online, file verification applications, upload purchase invoices, track application status via a visual interactive timeline, and download tamper-proof PDF certificates.
2. **Legal Metrology Inspectors** manage jurisdictional queues, schedule on-site/lab appointments, record calibration test readings with automated **Maximum Permissible Error (MPE)** tolerance checks, and issue digitally certified records.
3. **Public & Enforcement Officers** scan cryptographic QR codes on commercial scales or enter certificate numbers to verify authenticity in real-time without logging in.

---

## 🏗️ Technology Stack & Architecture

- **Backend**: Node.js & Express (MVC Architecture: Models, Controllers, Routes, Views, Services, Middleware)
- **Database**: SQLite via `better-sqlite3` (schema strictly compliant with ANSI SQL, easily portable to PostgreSQL/MySQL with foreign keys enabled)
- **Frontend / Templating**: Server-rendered EJS templates, external CSS design system (Government of India palette: Deep India Navy `#0B2545`, India Saffron `#FF9933`, Ashoka Chakra blue, accessible contrast), vanilla JavaScript.
- **Security & Integrity**:
  - `bcryptjs` password hashing (salt rounds: 10)
  - `express-session` role-based session guards (`merchant`, `inspector`, `admin`)
  - CSRF session token protection on mutative endpoints
  - `helmet` security headers with customized Content Security Policy
  - `multer` document upload restrictions (PDF, JPG, PNG whitelist; 2 MB limit)
  - Parameterized SQL queries (prepared statements preventing SQL injection)
  - Immutable audit logging for forensic traceability
- **Libraries**:
  - `qrcode`: Dynamic QR generation for public authenticity checks and PDF embedding
  - `pdfkit`: Official Government of India Verification Certificate generator
  - `chart.js`: Jurisdictional analytics (application trends, approval vs rejection rates, instrument breakdown)
- **Notifications Simulation**:
  - Simulated multi-channel dispatch (SMS & Email) logged in an interactive in-app notification drawer.

---

## 📂 Project Directory Structure

```text
c:\neeraj\sihpro\
├── controllers/
│   ├── authController.js         # Merchant & Inspector auth, registration validations
│   ├── publicController.js       # Landing page & public certificate verification
│   ├── merchantController.js     # Inventory CRUD, application wizard, tracker
│   └── inspectorController.js    # Jurisdictional queue, test calculator, approvals & revocation
├── database/
│   ├── db.js                     # better-sqlite3 connection with foreign keys & WAL mode
│   ├── schema.sql                # Relational schema (SQLite / PostgreSQL / MySQL)
│   └── seed.js                   # Demo database seeder
├── middleware/
│   ├── auth.js                   # requireAuth, requireRole, attachUser profiles
│   ├── csrf.js                   # Session CSRF token generator & validator
│   └── upload.js                 # Multer 2MB PDF/Image upload guard
├── public/
│   ├── css/
│   │   ├── main.css              # Gov portal tokens, typography, forms, tables, modals
│   │   ├── dashboard.css         # Metrics grid, stepper timeline, calculator styles
│   │   └── verify.css            # Certificate document, watermark, status banners
│   ├── js/
│   │   ├── main.js               # Modal helpers, notification drawer, demo autofill
│   │   ├── validation.js         # Client-side validation (GSTIN, mobile, capacities)
│   │   └── test-calculator.js    # Metrological test calculator & MPE tolerance check
│   └── images/
│       ├── logo.svg              # MetroVerify emblem logo
│       └── emblem.svg            # Ashoka Lion Capital Government Emblem
├── routes/
│   ├── auth.js                   # Login, register, logout
│   ├── public.js                 # Landing, verify certificate
│   ├── merchant.js               # Merchant portal routes
│   ├── inspector.js              # Inspector portal routes
│   └── api.js                    # AJAX endpoints
├── services/
│   ├── auditService.js           # System audit logging service
│   ├── notificationService.js    # In-app SMS & Email simulation service
│   ├── pdfService.js             # Official PDF certificate generator (pdfkit)
│   └── qrService.js              # QR code generation service (qrcode)
├── views/
│   ├── partials/
│   │   ├── header.ejs            # Government header, Ashoka emblem, language toggle
│   │   ├── footer.ejs            # Statutory references, SIH26036 problem credits
│   │   ├── navbar.ejs            # Role-aware responsive navigation bar
│   │   ├── flash.ejs             # Alert dismissals
│   │   └── notification-panel.ejs# Simulated SMS & Email drawer
│   ├── public/
│   │   ├── index.ejs             # Landing page with live metrics, Hindi toggle stub
│   │   └── verify.ejs            # Public certificate verification with QR & readings
│   ├── auth/
│   │   ├── login.ejs             # Login view with 1-click demo autofill pills
│   │   └── register.ejs          # Merchant registration with GSTIN & mobile checks
│   ├── merchant/
│   │   ├── dashboard.ejs         # Merchant KPIs, 30-day expiry banner, appointments
│   │   ├── instruments.ejs       # Equipment inventory
│   │   ├── instrument-form.ejs   # Metrological equipment specs form
│   │   ├── applications.ejs      # Verification applications list
│   │   ├── new-application.ejs   # Multi-instrument application wizard
│   │   ├── application-detail.ejs# 5-Step visual interactive status tracker
│   │   └── certificates.ejs      # Issued certificates list with QR modal & PDF download
│   └── inspector/
│       ├── dashboard.ejs         # District queue KPIs, daily appointments
│       ├── applications.ejs      # Multi-filter queue (status, district, type, search)
│       ├── application-detail.ejs# Review, schedule modal, dynamic test calculator
│       ├── certificates.ejs      # Certificate management & revocation modal
│       ├── analytics.ejs         # Chart.js visual charts & turnaround metrics
│       └── audit-log.ejs         # Security & action audit trail
├── uploads/
│   ├── certificates/             # Generated PDF certificates
│   └── documents/                # Merchant supporting documents
├── package.json
├── server.js                     # Express server startup
└── README.md
```

---

## ⚡ Quick Start & Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Seed Database with Realistic Demo Data
```bash
npm run seed
```
*This seeds 3 merchants, 10 instruments, 6 applications across different statuses, 2 inspectors, in-app notifications, audit logs, and automatically generates 3 official PDF certificates with scannable QR codes.*

### 3. Start the Web Application
```bash
npm start
```
The server will start at: **`http://localhost:3000`**

---

## 🔑 Demo Login Credentials

You can use the **1-click autofill buttons** on the `/auth/login` page for fast review, or enter:

| Role | Email | Password | Details |
|---|---|---|---|
| **Merchant** | `merchant@demo.com` | `Demo@123` | Rajesh Sharma, Sharma Kirana Mart (Central Delhi) |
| **Inspector** | `inspector@demo.com` | `Demo@123` | Vikramaditya Roy, Senior Inspector (Central Delhi) |
| **Merchant 2** | `merchant2@demo.com` | `Demo@123` | Sunita Patil, Patil Jewellers (Mumbai Suburban) |
| **Inspector 2**| `inspector2@demo.com`| `Demo@123` | Meenakshi Iyer, Inspector (Mumbai Suburban) |

---

## 🔍 Pre-Configured Test Certificates (Public Verification)

Visit **`http://localhost:3000/verify`** or click the demo pills on the verify screen:

1. **🟢 Valid Certificate**:  
   `LM-2026-DL-104920` (Essae DS-215 scale, Class III, fully compliant, active QR, downloadable PDF)
2. **🟡 Expiring Soon (<30 Days)**:  
   `LM-2025-MH-084219` (Sartorius Gold balance, Class II, triggers 30-day renewal alert on Merchant Dashboard)
3. **🔴 Revoked Certificate**:  
   `LM-2026-DL-002158` (Avery Weighbridge, revoked after surprise market raid revealed tampered lead seal)

---

## ⏱️ 90-Second Demo Script for SIH Judges

Follow these exact steps to demonstrate all key innovations within 90 seconds:

- **0:00 - 0:15 | Public Trust & Authenticity Check**:
  1. Open `http://localhost:3000/`.
  2. Point out the official Government of India header, tricolor stripe, SIH 2026 Problem ID badge, and click the **"हिंदी"** stub to demonstrate bilingual accessibility.
  3. Click **"Verify a Certificate"** in the navigation bar.
  4. Click the demo button **"🟢 Valid (LM-2026-DL-104920)"**. Show the green **"OFFICIALLY VERIFIED & VALID"** status banner, instrument specifications, calibration test readings table, and click **"Download Official PDF Certificate"** to show the generated PDF.
  5. Click **"🔴 Revoked (LM-2026-DL-002158)"** to demonstrate the red revocation warning and legal cease-and-desist reason.

- **0:15 - 0:40 | Merchant Workflow & 30-Day Expiry Alert**:
  1. Click **"Merchant Login"** and click the **1-click autofill** for `merchant@demo.com` &rarr; Click **"Sign In to Portal"**.
  2. Show the **Merchant Dashboard**: Total Instruments (4), Pending Applications, and the **30-Day Certificate Expiry Alert Banner**.
  3. Click **"Applications"** &rarr; Open **`APP-2026-DL-1001`**.
  4. Highlight the **Interactive 5-Step Lifecycle Tracker**: *Submitted &rarr; Under Review &rarr; Scheduled &rarr; Verified &rarr; Certificate Issued*.
  5. Click the **Notification Bell 🔔** at the top right to open the **Notifications Center** showcasing simulated real-time SMS & Email dispatches.

- **0:40 - 1:15 | Inspector Portal, Automated MPE Calculator & Certificate Issuance**:
  1. Click **"Logout"**, then click **"Inspector Login"** &rarr; Click **1-click autofill** for `inspector@demo.com` &rarr; Click **"Sign In"**.
  2. Show the **Inspector Dashboard** tied to the **Central Delhi Jurisdiction**, displaying active queue counts and today's appointments.
  3. Click **"Applications Queue"** &rarr; Filter by District or Status. Click **"Review & Verify"** on pending application **`APP-2026-DL-1006`** (or `APP-2026-DL-1004`).
  4. Show the Merchant Profile, uploaded purchase invoice download link, and the **Verification Appointment Schedule Modal**.
  5. Scroll to the **Record Metrological Test Readings Calculator**:
     - Type in Nominal Load and Observed Reading. Show the **real-time error calculation** (`Observed - Nominal`).
     - Point out the **Automated MPE Tolerance Check** (Pass/Fail indicator) based on Accuracy Class.
     - Select **"Approve & Generate Digital Certificate"** &rarr; Click **"Submit Verification Record & Complete"**.
     - Notice that a unique certificate number (e.g. `LM-2026-DL-XXXXXX`) and an official PDF certificate are generated on the spot!

- **1:15 - 1:30 | Governance Analytics, Revocation & Audit Trail**:
  1. Click **"Certificates"** &rarr; Show the issued certificates registry. Demonstrate clicking **"Revoke"** to enforce immediate revocation with a mandatory legal reason.
  2. Click **"Analytics"** to show the interactive **Chart.js visualizations**: Applications daily trend, Approval vs Rejection doughnut, and Instrument distribution.
  3. Click **"Audit Trail"** to showcase the tamper-proof forensic log recording user actions, IP addresses, and timestamps.

---

## ⚖️ Legal & Regulatory Compliance

This prototype adheres to the statutory provisions of:
- **The Legal Metrology Act, 2009 (Act 1 of 2010)** — Sections 22, 24, and 44.
- **The Legal Metrology (General) Rules, 2011** — Verification and Stamping Procedures under Rule 27, Fourth Schedule, and Seventh Schedule.
- **OIML Recommendation R 76** (Non-automatic weighing instruments) standards for Maximum Permissible Error (MPE) tolerances across Class I, Class II, Class III, and Class IIII.
