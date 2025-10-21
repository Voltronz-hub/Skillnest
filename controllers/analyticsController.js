const User = require('../models/User');
const Job = require('../models/Job');
const Proposal = require('../models/Proposal');
const Review = require('../models/Review');
const Dispute = require('../models/Dispute');

const asyncHandler = require('../middleware/asyncHandler');

// Freelancer Analytics
exports.getFreelancerAnalytics = asyncHandler(async (req, res) => {
  const userId = req.session.userId;

  // Earnings over time (monthly)
  const monthlyEarnings = await Job.aggregate([
    { $match: { freelancer: userId, status: 'completed' } },
    {
      $group: {
        _id: {
          year: { $year: '$completedAt' },
          month: { $month: '$completedAt' }
        },
        totalEarnings: { $sum: '$escrowAmount' },
        jobCount: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': -1, '_id.month': -1 } },
    { $limit: 12 }
  ]);

  // Job completion rate
  const totalJobs = await Job.countDocuments({ freelancer: userId });
  const completedJobs = await Job.countDocuments({ freelancer: userId, status: 'completed' });
  const completionRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

  // Average response time (days)
  const proposals = await Proposal.find({ freelancer: userId }).populate('job');
  const responseTimes = proposals
    .filter(p => p.job)
    .map(p => (new Date(p.createdAt) - new Date(p.job.createdAt)) / (1000 * 60 * 60 * 24));
  const avgResponseTime = responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;

  // Client satisfaction (average rating)
  const reviews = await Review.find({ job: { $in: (await Job.find({ freelancer: userId, status: 'completed' })).map(j => j._id) } });
  const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  // Top skills/categories
  const jobCategories = await Job.aggregate([
    { $match: { freelancer: userId, status: 'completed' } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 }
  ]);

  // Recent earnings
  const recentEarnings = await Job.find({ freelancer: userId, status: 'completed' })
    .populate('postedBy', 'username')
    .sort({ completedAt: -1 })
    .limit(10)
    .select('title escrowAmount completedAt postedBy');

  res.render('analytics/freelancer-earnings', {
    monthlyEarnings,
    completionRate,
    avgResponseTime,
    avgRating,
    jobCategories,
    recentEarnings,
    totalEarnings: monthlyEarnings.reduce((sum, m) => sum + m.totalEarnings, 0)
  });
});

// Client Analytics
exports.getClientAnalytics = asyncHandler(async (req, res) => {
  const userId = req.session.userId;

  // Job performance metrics
  const jobs = await Job.find({ postedBy: userId });
  const totalJobs = jobs.length;
  const completedJobs = jobs.filter(j => j.status === 'completed').length;
  const activeJobs = jobs.filter(j => j.status === 'in-progress' || j.status === 'open').length;
  const cancelledJobs = jobs.filter(j => j.status === 'cancelled').length;

  // Average time to hire
  const hiredJobs = jobs.filter(j => j.freelancer);
  const timeToHire = hiredJobs.length > 0 ?
    hiredJobs.map(j => (new Date(j.updatedAt) - new Date(j.createdAt)) / (1000 * 60 * 60 * 24)).reduce((a, b) => a + b, 0) / hiredJobs.length : 0;

  // Budget vs actual spend
  const totalBudget = jobs.reduce((sum, j) => sum + (j.budget || 0), 0);
  const totalSpent = jobs.filter(j => j.status === 'completed').reduce((sum, j) => sum + (j.escrowAmount || 0), 0);

  // Freelancer performance
  const freelancerPerformance = await Promise.all(
    hiredJobs.map(async (job) => {
      const reviews = await Review.find({ job: job._id });
      const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
      return {
        freelancer: job.freelancer,
        jobTitle: job.title,
        rating: avgRating,
        completedOnTime: job.completedAt ? new Date(job.completedAt) <= new Date(job.deadline) : false
      };
    })
  );

  // Monthly spending
  const monthlySpending = await Job.aggregate([
    { $match: { postedBy: userId, status: 'completed' } },
    {
      $group: {
        _id: {
          year: { $year: '$completedAt' },
          month: { $month: '$completedAt' }
        },
        totalSpent: { $sum: '$escrowAmount' },
        jobCount: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': -1, '_id.month': -1 } },
    { $limit: 12 }
  ]);

  // Popular categories
  const categoryStats = await Job.aggregate([
    { $match: { postedBy: userId } },
    { $group: { _id: '$category', count: { $sum: 1 }, avgBudget: { $avg: '$budget' } } },
    { $sort: { count: -1 } },
    { $limit: 5 }
  ]);

  res.render('analytics/client-performance', {
    jobStats: { totalJobs, completedJobs, activeJobs, cancelledJobs },
    timeToHire,
    budgetStats: { totalBudget, totalSpent },
    freelancerPerformance,
    monthlySpending,
    categoryStats
  });
});

// Admin Analytics
exports.getAdminAnalytics = asyncHandler(async (req, res) => {
  // Platform growth metrics
  const totalUsers = await User.countDocuments();
  const totalJobs = await Job.countDocuments();
  const totalProposals = await Proposal.countDocuments();
  const totalRevenue = (await Job.find({ status: 'completed' })).reduce((sum, j) => sum + (j.escrowAmount || 0), 0);

  // User growth over time
  const userGrowth = await User.aggregate([
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': -1, '_id.month': -1 } },
    { $limit: 12 }
  ]);

  // Job completion rate
  const completedJobs = await Job.countDocuments({ status: 'completed' });
  const platformCompletionRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

  // Revenue by category
  const revenueByCategory = await Job.aggregate([
    { $match: { status: 'completed' } },
    { $group: { _id: '$category', revenue: { $sum: '$escrowAmount' }, count: { $sum: 1 } } },
    { $sort: { revenue: -1 } },
    { $limit: 10 }
  ]);

  // Top performing freelancers
  const topFreelancers = await Job.aggregate([
    { $match: { status: 'completed', freelancer: { $ne: null } } },
    {
      $group: {
        _id: '$freelancer',
        completedJobs: { $sum: 1 },
        totalEarnings: { $sum: '$escrowAmount' }
      }
    },
    { $sort: { totalEarnings: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'freelancer'
      }
    },
    { $unwind: '$freelancer' },
    { $project: { username: '$freelancer.username', completedJobs: 1, totalEarnings: 1 } }
  ]);

  // Dispute statistics
  const totalDisputes = await Dispute.countDocuments();
  const resolvedDisputes = await Dispute.countDocuments({ status: 'resolved' });
  const disputeResolutionRate = totalDisputes > 0 ? (resolvedDisputes / totalDisputes) * 100 : 0;

  // Geographic distribution
  const userLocations = await User.aggregate([
    { $match: { location: { $ne: null } } },
    { $group: { _id: '$location', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  // Monthly platform activity
  const monthlyActivity = await Job.aggregate([
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        jobsPosted: { $sum: 1 },
        completedJobs: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        }
      }
    },
    { $sort: { '_id.year': -1, '_id.month': -1 } },
    { $limit: 12 }
  ]);

  res.render('analytics/admin-insights', {
    overview: { totalUsers, totalJobs, totalProposals, totalRevenue, platformCompletionRate },
    userGrowth,
    revenueByCategory,
    topFreelancers,
    disputeStats: { totalDisputes, resolvedDisputes, disputeResolutionRate },
    userLocations,
    monthlyActivity
  });
});
