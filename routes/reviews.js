const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');

router.post('/submit', reviewController.submitReview);
router.get('/job/:jobId', reviewController.getJobReviews);

module.exports = router;
