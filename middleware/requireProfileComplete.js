const User = require('../models/User');

// Middleware factory: checks profile completeness based on role
// roleRequired: 'freelancer' or 'client'
module.exports = function(roleRequired) {
  return async function(req, res, next) {
    try {
      if (!req.session || !req.session.userId) return res.redirect('/auth/login');
      const user = await User.findById(req.session.userId).lean();
      if (!user) return res.redirect('/auth/login');

      // Basic completeness checks
      const hasName = !!(user.name && user.name.trim());
      const hasImage = !!user.profileImage;

      if (roleRequired === 'freelancer') {
        const hasSkills = Array.isArray(user.skills) && user.skills.length > 0;
        const hasRate = !!(user.hourlyRate && Number(user.hourlyRate) > 0);
        if (!(hasName && hasImage && hasSkills && hasRate)) {
          req.session.userFlash = 'Please complete your freelancer profile (name, image, skills, hourly rate) before taking this action.';
          return res.redirect('/profile/edit');
        }
      } else if (roleRequired === 'client') {
        const hasCompanyOrName = !!(user.company || user.name);
        if (!(hasName && hasImage && hasCompanyOrName)) {
          req.session.userFlash = 'Please complete your client profile (name, image and company) before taking this action.';
          return res.redirect('/profile/edit');
        }
      } else {
        // generic check
        if (!(hasName && hasImage)) {
          req.session.userFlash = 'Please complete your profile (name and profile image) before taking this action.';
          return res.redirect('/profile/edit');
        }
      }
      // ok
      next();
    } catch (err) {
      console.error('Profile completeness check error', err);
      return res.redirect('/profile/edit');
    }
  };
};
