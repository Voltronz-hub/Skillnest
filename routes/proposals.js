const express = require('express');
const router = express.Router();
const Proposal = require('../models/Proposal');
const Job = require('../models/Job');
const Contract = require('../models/Contract');
const requireProfileComplete = require('../middleware/requireProfileComplete');

// Submit proposal (freelancer only)
router.post('/submit', requireProfileComplete('freelancer'), async (req, res) => {
  if (req.session.role !== 'freelancer') return res.redirect('/jobs');
  const { jobId, message } = req.body;
  const proposal = new Proposal({ job: jobId, freelancer: req.session.userId, message });
  await proposal.save();
  await Job.findByIdAndUpdate(jobId, { $push: { proposals: proposal._id } });
  res.redirect('/jobs/' + jobId);
});

// Accept proposal (client only)
router.post('/accept', async (req, res) => {
  if (req.session.role !== 'client6') return res.redirect('/jobs');
  const { proposalId } = req.body;
  await Proposal.findByIdAndUpdate(proposalId, { status: 'hired' });
  res.redirect('back');
});

// Client hires a freelancer for a proposal (sets status to 'hired')
router.post('/:id/hire', async (req, res) => {
  try {
    // ensure client profile complete before hiring
    // require profile completeness and admin approval for clients to hire
    await requireProfileComplete('client', { requireAdminApproval: true })(req, res, async () => {});
    if (req.session.role !== 'client') return res.status(403).send('Forbidden');
    const id = req.params.id;
    const p = await Proposal.findById(id).populate('job');
    if (!p) return res.status(404).send('Not found');
    // mark as hired
    p.status = 'hired';
    await p.save();
    // optional: mark job as taken
    await Job.findByIdAndUpdate(p.job._id, { $set: { hiredProposal: p._id } });
    // emit socket notification to the freelancer
    try {
      const io = req.app.get('io');
      if (io && p.freelancer) io.to('user:' + p.freelancer.toString()).emit('notification', { type: 'hired', proposalId: p._id, jobId: p.job._id });
    } catch (e) { console.error('socket emit hire', e); }
    return res.json({ ok: true });
  } catch (err) {
    console.error('hire error', err);
    return res.status(500).json({ error: 'Failed' });
  }
});

// Unhire (undo) - client only
router.post('/:id/unhire', async (req, res) => {
  try {
    if (req.session.role !== 'client') return res.status(403).send('Forbidden');
    const id = req.params.id;
    const p = await Proposal.findById(id).populate('job');
    if (!p) return res.status(404).send('Not found');
    p.status = 'pending';
    await p.save();
    if (p.job && p.job.hiredProposal && p.job.hiredProposal.toString() === p._id.toString()) {
      await Job.findByIdAndUpdate(p.job._id, { $unset: { hiredProposal: '' } });
    }
  const io = req.app.get('io');
  if (io && p.freelancer) io.to('user:' + p.freelancer.toString()).emit('notification', { type: 'unhired', proposalId: p._id, jobId: p.job._id });
    return res.json({ ok: true });
  } catch (err) { console.error('unhire error', err); return res.status(500).json({ error: 'Failed' }); }
});

// Freelancer responds to a hire request (accept/reject)
router.post('/:id/respond', async (req, res) => {
  try {
    if (req.session.role !== 'freelancer') return res.status(403).send('Forbidden');
    const id = req.params.id;
    const { action } = req.body; // 'accept' or 'reject'
    const p = await Proposal.findById(id).populate('freelancer');
    if (!p) return res.status(404).send('Not found');
    if ((p.freelancer && p.freelancer._id.toString()) !== (req.session.userId || '')) return res.status(403).send('Forbidden');
    if (action === 'accept') p.status = 'accepted';
    else p.status = 'rejected';
    await p.save();
    // if accepted, create a Contract and a default milestone
    if (p.status === 'accepted') {
      try {
        const contract = new Contract({ job: p.job, proposal: p._id, client: p.job.client, freelancer: p.freelancer });
        contract.milestones = [{ title: 'Initial milestone', dueDate: null, amount: 0 }];
        await contract.save();
  // emit notification to client
  const io = req.app.get('io');
  if (io && p.job && p.job.client) io.to('user:' + p.job.client.toString()).emit('notification', { type: 'proposal_accepted', proposalId: p._id, jobId: p.job });
      } catch (e) { console.error('contract create error', e); }
    } else {
      // rejected -> notify client
        try {
        const io = req.app.get('io');
        if (io && p.job && p.job.client) io.to('user:' + p.job.client.toString()).emit('notification', { type: 'proposal_rejected', proposalId: p._id, jobId: p.job });
      } catch (e) { console.error('socket emit reject', e); }
    }
    return res.json({ ok: true, status: p.status });
  } catch (err) {
    console.error('respond error', err);
    return res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
