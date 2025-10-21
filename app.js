const express = require('express');
// Performance & security
const compression = require('compression');
const helmet = require('helmet');
require('dotenv').config();
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const http = require('http');
const socketio = require('socket.io');
const path = require('path');
const User = require('./models/User');

const app = express();

// Basic production hardening & performance
app.disable('x-powered-by');
// Use compression and helmet early in the middleware chain when running in production
if (process.env.NODE_ENV === 'production') {
  try { app.use(helmet()); } catch (e) { /* ignore if not installed */ }
  try { app.use(compression()); } catch (e) { /* ignore if not installed */ }
  // Enable view caching for template engine
  app.set('view cache', true);
}
// Note: server and socket.io are only created when running the app directly
// (not when imported by a serverless wrapper such as Vercel). This lets us
// export the Express `app` for serverless platforms while still supporting
// a normal HTTP + Socket.IO server when run with `node app.js`.
const Message = require('./models/Message');
const Job = require('./models/Job');

// MongoDB connection
const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/skillnest-dev';
// Add shorter server selection timeout to fail fast on DNS/resolution issues
mongoose.connect(mongoUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  // Fail quickly if DNS lookup or server selection takes too long (ms)
  serverSelectionTimeoutMS: parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || '5000', 10),
  socketTimeoutMS: parseInt(process.env.MONGO_SOCKET_TIMEOUT_MS || '45000', 10)
}).catch(err => {
  console.error('MongoDB connection error (startup):', err && err.message ? err.message : err);
  // Keep process exit behavior to the caller but log helpful guidance
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
// Serve static assets with aggressive caching in production
const staticOpts = process.env.NODE_ENV === 'production' ? { maxAge: 1000 * 60 * 60 * 24 * 7 } : {};
app.use(express.static(path.join(__dirname, 'public'), staticOpts));
app.use(express.urlencoded({ extended: true }));

// Session setup (export middleware so Socket.IO can reuse it)
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'skillnest_secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI || mongoUrl })
});
app.use(sessionMiddleware);

// Make io available to routes if needed

// Make logged-in user available to all views via res.locals
app.use(async (req, res, next) => {
  // Set minimal authenticated state from session immediately so UI can
  // render login/logout controls even when the DB is unreachable.
  if (req.session && req.session.userId) {
    res.locals.user = { _id: req.session.userId };
    res.locals.role = req.session.role || null;
    res.locals.profileImage = null;
  } else {
    res.locals.user = null;
    res.locals.role = null;
    res.locals.profileImage = null;
  }

  try {
    // Attempt to enrich res.locals.user with full user data from DB.
    // If this fails (DB down), keep the minimal session-derived values so
    // templates still know the user is signed in.
    if (req.session && req.session.userId) {
      const u = await User.findById(req.session.userId).lean();
      if (u) {
        res.locals.user = u;
        res.locals.role = u.role;
        res.locals.profileImage = u.profileImage;
      }
    }
  } catch (err) {
    console.error('res.locals user middleware error (DB lookup):', err && err.message ? err.message : err);
    // Keep minimal res.locals values from session rather than clearing them.
  }

  next();
});

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/jobs', require('./routes/jobs'));
app.use('/proposals', require('./routes/proposals'));
app.use('/chat', require('./routes/chat'));
app.use('/profile', require('./routes/profile'));
app.use('/admin', require('./routes/admin'));
app.use('/saved-searches', require('./routes/savedSearches'));
app.use('/notifications', require('./routes/notifications'));

// Setup socket.io handlers in a function so we can call it when a real
// HTTP server + socket.io instance exists (we don't run sockets on Vercel).
function setupSockets(ioInstance) {
  // Share session middleware with Socket.IO
  ioInstance.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
  });

  // Socket.IO setup with session-based auth
  ioInstance.on('connection', (socket) => {
    try {
      const req = socket.request;
      const sid = req.sessionID;
      const sess = req.session;
      if (!sess || !sess.userId) {
        console.log('Unauthenticated socket connection rejected:', socket.id);
        socket.disconnect(true);
        return;
      }
      const authedUserId = sess.userId;
      console.log('User connected (socket):', socket.id, 'userId:', authedUserId);
      // track presence
      if (!global.__onlineUsers) global.__onlineUsers = new Map();
      global.__onlineUsers.set('' + authedUserId, (global.__onlineUsers.get('' + authedUserId) || 0) + 1);
      // broadcast presence update
      ioInstance.emit('presenceUpdate', { userId: authedUserId, online: true });
      // join a personal room so we can emit targeted notifications to this user
      try {
        socket.join('user:' + authedUserId);
      } catch (e) { /* ignore */ }

      // Join a job-specific room
      socket.on('joinRoom', async (data) => {
        try {
          const jobId = data && data.jobId ? data.jobId : socket.jobId;
          if (!jobId) return;
          socket.join(jobId);
          socket.jobId = jobId;
          socket.userId = authedUserId;
          console.log(`Socket ${socket.id} joined room ${jobId}`);
          // Load recent messages and send to client
          const recent = await Message.find({ jobId }).sort({ createdAt: -1 }).limit(50).populate('sender', 'username').lean();
          socket.emit('recentMessages', recent.reverse().map(m => ({ message: m.message, sender: m.sender ? m.sender.username : m.sender, createdAt: m.createdAt })));
        } catch (err) {
          console.error('joinRoom error:', err);
        }
      });

      // Handle incoming chat messages (text)
      socket.on('chatMessage', async (data) => {
        try {
          const jobId = data && data.jobId ? data.jobId : socket.jobId;
          const message = data && data.message ? data.message : null;
          if (!jobId || !message) return;

          const job = await Job.findById(jobId).lean();
          const receiver = job && job.client ? job.client : null;

          const msgDoc = new Message({ jobId, sender: authedUserId, receiver: receiver || authedUserId, message, createdAt: new Date() });
          await msgDoc.save();

          const senderUser = await User.findById(authedUserId).select('username').lean();
          const payload = { message: message, sender: senderUser ? senderUser.username : authedUserId, createdAt: msgDoc.createdAt };
          ioInstance.to(jobId).emit('chatMessage', payload);
          // also emit an unread update to conversation lists (simple approach)
          ioInstance.emit('unreadUpdate', { jobId, receiver: msgDoc.receiver, messageId: msgDoc._id, createdAt: msgDoc.createdAt });
        } catch (err) {
          console.error('chatMessage error:', err);
        }
      });

      // mark messages as read in a job room for this user
      socket.on('markRead', async (data) => {
        try {
          const jobId = data && data.jobId ? data.jobId : socket.jobId;
          if (!jobId) return;
          // mark messages where receiver is this user and not yet read
          await Message.updateMany({ jobId, receiver: authedUserId, read: false }, { $set: { read: true } });
          // notify other clients in the room that these messages were read
          ioInstance.to(jobId).emit('messageRead', { jobId, userId: authedUserId });
        } catch (err) {
          console.error('markRead error', err);
        }
      });

      // presence ping from client (optional)
      socket.on('presence', (data) => {
        try {
          ioInstance.emit('presenceUpdate', { userId: authedUserId, online: true });
        } catch(e) { /* ignore */ }
      });

      socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // decrement presence count
        try {
          const prev = global.__onlineUsers && global.__onlineUsers.get('' + authedUserId) ? global.__onlineUsers.get('' + authedUserId) : 0;
          if (prev <= 1) {
            global.__onlineUsers && global.__onlineUsers.delete('' + authedUserId);
            ioInstance.emit('presenceUpdate', { userId: authedUserId, online: false });
          } else {
            global.__onlineUsers && global.__onlineUsers.set('' + authedUserId, prev - 1);
          }
        } catch(err) { /* ignore */ }
      });
    } catch (err) {
      console.error('socket connection handler error:', err);
    }
  });
}

// If run directly (node app.js) create a real HTTP server + Socket.IO.
if (require.main === module) {
  const server = http.createServer(app);
  const io = socketio(server);
  app.set('io', io);
  setupSockets(io);

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`SkillNest server running on port ${PORT}`);
  });
}

// Export the Express app so serverless wrappers can import it.
module.exports = app;
