const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

router.get('/', publicController.getLanding);
router.get('/verify', publicController.getVerify);
router.get('/verify/:certNo', publicController.getVerify);

module.exports = router;
