const express = require('express');
const router = express.Router();
const inspectorController = require('../controllers/inspectorController');
const { requireAuth, requireRole } = require('../middleware/auth');

// Guard all inspector routes
router.use(requireAuth, requireRole('inspector'));

// Dashboard
router.get('/dashboard', inspectorController.getDashboard);

// Application Queue & Details
router.get('/applications', inspectorController.getApplications);
router.get('/applications/:id', inspectorController.getApplicationDetail);

// Actions
router.post('/applications/:id/request-info', inspectorController.postRequestInfo);
router.post('/applications/:id/schedule', inspectorController.postSchedule);
router.post('/applications/:id/verify-result', inspectorController.postVerifyResult);

// Certificates Management & Revocation
router.get('/certificates', inspectorController.getCertificates);
router.post('/certificates/revoke', inspectorController.postRevokeCertificate);

// Analytics & Audit Trail
router.get('/analytics', inspectorController.getAnalytics);
router.get('/audit-log', inspectorController.getAuditLog);

module.exports = router;
