/**
 * Usage: node scripts/create-admin.js --username USERNAME --email EMAIL --password PASSWORD
 * This script will connect to MONGODB_URI from environment and create or update an admin user.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach((a) => {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      args[k] = v || true;
    }
  });
  return args;
}

async function main() {
  const args = parseArgs();
  const username = args.username || 'EhsanaliKhan';
  const email = args.email || 'EhsanAdmin12345@gmail.com';
  const password = args.password || 'Admin12345';

  const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/skillnest-dev';
  console.log('Connecting to', mongoUrl);
  await mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    const hashed = await bcrypt.hash(password, 10);
    const update = {
      username,
      email: email.toLowerCase(),
      password: hashed,
      role: 'admin',
      verified: true,
      verificationStatus: 'approved'
    };
    const user = await User.findOneAndUpdate({ email: update.email }, update, { upsert: true, new: true, setDefaultsOnInsert: true });
    console.log('Admin user created/updated:', user.email, 'id:', user._id.toString());
  } catch (err) {
    console.error('Failed to create admin:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main();
