const User = require('../models/User');
const Job = require('../models/Job');
const Proposal = require('../models/Proposal');
const Review = require('../models/Review');
const Notification = require('../models/Notification');

const asyncHandler = require('../middleware/asyncHandler');

exports.getDashboard = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/auth/login');
  }

  const userId = req.session.userId;
  const role = req.session.role;

  const notifications = await Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(10);

  if (role === 'freelancer') {
    // Freelancer Dashboard
    const activeJobs = await Job.find({ freelancer: userId, status: { $in: ['open', 'in-progress'] } })
      .populate('postedBy', 'username')
      .sort({ createdAt: -1 });

    const proposalsSent = await Proposal.find({ freelancer: userId })
      .populate('job', 'title')
      .sort({ createdAt: -1 });

    const completedJobs = await Job.find({ freelancer: userId, status: 'completed' });
    const totalEarnings = completedJobs.reduce((sum, job) => sum + (job.escrowAmount || 0), 0);

    const reviews = await Review.find({ job: { $in: completedJobs.map(j => j._id) } })
      .populate('reviewer', 'username')
      .populate('job', 'title');

    const averageRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

    res.render('dashboard-freelancer', {
      user: await User.findById(userId),
      activeJobs,
      proposalsSent,
      totalEarnings,
      reviews,
      averageRating,
      reviewCount: reviews.length,
      notifications
    });
  } else if (role === 'client') {
    // Client Dashboard
    const postedJobs = await Job.find({ postedBy: userId })
      .populate('freelancer', 'username')
      .sort({ createdAt: -1 });

    const proposalsReceived = await Proposal.find({ job: { $in: postedJobs.map(j => j._id) } })
      .populate('freelancer', 'username')
      .populate('job', 'title')
      .sort({ createdAt: -1 });

    const completedJobs = postedJobs.filter(job => job.status === 'completed');
    const totalPayments = completedJobs.reduce((sum, job) => sum + (job.budget || 0), 0);

    const hiredFreelancers = [...new Set(postedJobs.filter(job => job.freelancer).map(job => job.freelancer._id.toString()))];

    res.render('dashboard-client', {
      user: await User.findById(userId),
      postedJobs,
      proposalsReceived,
      totalPayments,
      hiredFreelancersCount: hiredFreelancers.length,
      notifications
    });
  } else {
    res.status(403).render('error', { message: 'Access Denied', error: 'Invalid role', status: 403 });
  }
});
