const Review = require('../models/Review');
const Job = require('../models/Job');
const User = require('../models/User');

exports.submitReview = async (req, res) => {
  try {
    const { jobId, rating, comment } = req.body;
    const reviewerId = req.session.userId;

    // Find the job
    const job = await Job.findById(jobId).populate('postedBy freelancer');
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    // Check if job is completed
    if (job.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Can only review completed jobs' });
    }

    // Determine who is being reviewed
    let revieweeId;
    if (job.postedBy._id.toString() === reviewerId.toString()) {
      // Client reviewing freelancer
      revieweeId = job.freelancer._id;
    } else if (job.freelancer && job.freelancer._id.toString() === reviewerId.toString()) {
      // Freelancer reviewing client
      revieweeId = job.postedBy._id;
    } else {
      return res.status(403).json({ success: false, message: 'Not authorized to review this job' });
    }

    // Check if review already exists
    const existingReview = await Review.findOne({ job: jobId, reviewer: reviewerId });
    if (existingReview) {
      return res.status(400).json({ success: false, message: 'You have already reviewed this job' });
    }

    // Create the review
    const review = new Review({
      job: jobId,
      reviewer: reviewerId,
      rating: parseInt(rating),
      comment
    });

    await review.save();

    // Update the reviewee's average rating
    await updateUserRating(revieweeId);

    res.json({ success: true, message: 'Review submitted successfully' });
  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit review' });
  }
};

exports.getJobReviews = async (req, res) => {
  try {
    const { jobId } = req.params;

    const reviews = await Review.find({ job: jobId })
      .populate('reviewer', 'username')
      .sort({ createdAt: -1 });

    res.json({ success: true, reviews });
  } catch (error) {
    console.error('Get job reviews error:', error);
    res.status(500).json({ success: false, message: 'Failed to load reviews' });
  }
};

async function updateUserRating(userId) {
  try {
    const reviews = await Review.find({ job: { $in: await Job.find({ $or: [{ postedBy: userId }, { freelancer: userId }] }).distinct('_id') } });

    if (reviews.length > 0) {
      const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
      const averageRating = totalRating / reviews.length;

      await User.findByIdAndUpdate(userId, {
        averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
        reviewCount: reviews.length
      });
    }
  } catch (error) {
    console.error('Update user rating error:', error);
  }
}
