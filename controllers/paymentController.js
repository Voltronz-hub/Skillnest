const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Job = require('../models/Job');
const User = require('../models/User');
const { createNotification, sendEmailNotification } = require('./notificationController');

// Create payment intent for job
exports.createPaymentIntent = async (req, res) => {
  try {
    const { jobId } = req.body;
    const userId = req.session.userId;

    const job = await Job.findById(jobId).populate('postedBy');
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    // Check if user is the job poster
    if (job.postedBy._id.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Check if job has freelancer assigned
    if (!job.freelancer) {
      return res.status(400).json({ success: false, message: 'No freelancer assigned to this job' });
    }

    // Check if payment already exists
    if (job.paymentStatus === 'paid' || job.paymentStatus === 'released') {
      return res.status(400).json({ success: false, message: 'Payment already processed' });
    }

    const amount = Math.round(job.budget * 100); // Convert to cents

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'myr', // Malaysian Ringgit
      metadata: {
        jobId: job._id.toString(),
        clientId: userId,
        freelancerId: job.freelancer.toString()
      }
    });

    // Update job with payment intent
    job.paymentIntentId = paymentIntent.id;
    job.paymentStatus = 'pending';
    await job.save();

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ success: false, message: 'Failed to create payment intent' });
  }
};

// Confirm payment and hold in escrow
exports.confirmPayment = async (req, res) => {
  try {
    const { paymentIntentId } = req.body;

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      const job = await Job.findOne({ paymentIntentId });
      if (job) {
        job.paymentStatus = 'held'; // Funds held in escrow
        job.escrowAmount = paymentIntent.amount / 100; // Convert back to MYR
        await job.save();
      }

      res.json({ success: true, message: 'Payment confirmed and held in escrow' });
    } else {
      res.status(400).json({ success: false, message: 'Payment not successful' });
    }
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ success: false, message: 'Failed to confirm payment' });
  }
};

// Release payment to freelancer
exports.releasePayment = async (req, res) => {
  try {
    const { jobId } = req.body;
    const userId = req.session.userId;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    // Only job poster can release payment
    if (job.postedBy.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (job.paymentStatus !== 'held') {
      return res.status(400).json({ success: false, message: 'Payment not held in escrow' });
    }

    // In a real implementation, you would transfer funds to freelancer's Stripe account
    // For now, we'll just mark as released
    job.paymentStatus = 'released';
    await job.save();

    // Notify freelancer about payment release
    const freelancer = await User.findById(job.freelancer);
    if (freelancer) {
      const notifMessage = `Payment of RM${job.escrowAmount} has been released for job "${job.title}"`;
      await createNotification(freelancer._id, 'payment_release', notifMessage, `/jobs/${jobId}`);
      await sendEmailNotification(freelancer.email, 'Payment Released', notifMessage);
    }

    res.json({ success: true, message: 'Payment released to freelancer' });
  } catch (error) {
    console.error('Release payment error:', error);
    res.status(500).json({ success: false, message: 'Failed to release payment' });
  }
};

// Get payment status
exports.getPaymentStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.session.userId;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    // Only job poster or assigned freelancer can view
    if (job.postedBy.toString() !== userId && job.freelancer?.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    res.json({
      success: true,
      paymentStatus: job.paymentStatus,
      escrowAmount: job.escrowAmount,
      budget: job.budget
    });
  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({ success: false, message: 'Failed to get payment status' });
  }
};
