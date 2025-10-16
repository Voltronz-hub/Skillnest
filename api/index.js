const serverless = require('serverless-http');
const app = require('../app');

// Export a handler that Vercel (and other serverless platforms) can call.
// Note: Socket.IO won't work in this serverless environment. For real-time
// features consider a separate Socket.IO server (Heroku, DigitalOcean, or
// a managed WebSocket provider) or use a Vercel Edge/Realtime alternative.
module.exports = serverless(app);
