const express = require('express');
const router = express.Router();
const merchantController = require('../controllers/merchantController');
const { requireAuth, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Guard all merchant routes
router.use(requireAuth, requireRole('merchant'));

// Dashboard
router.get('/dashboard', merchantController.getDashboard);

// Instruments CRUD
router.get('/instruments', merchantController.getInstruments);
router.get('/instruments/new', merchantController.getInstrumentForm);
router.post('/instruments/new', merchantController.postInstrument);
router.get('/instruments/:id/edit', merchantController.getInstrumentForm);
router.post('/instruments/:id/edit', merchantController.postInstrument);
router.post('/instruments/:id/delete', merchantController.deleteInstrument);

// Verification Applications
router.get('/applications', merchantController.getApplications);
router.get('/applications/new', merchantController.getNewApplication);
router.post('/applications/new', upload.single('document'), merchantController.postNewApplication);
router.get('/applications/:id', merchantController.getApplicationDetail);

// Certificates
router.get('/certificates', merchantController.getCertificates);

module.exports = router;
