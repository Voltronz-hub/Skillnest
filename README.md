# Skillnest

This is a Node.js + Express + EJS freelancer marketplace application.

Quick start (local):

1. Install dependencies:

```powershell
cd C:\Skillnest
npm install --legacy-peer-deps
```

2. Copy environment variables into a `.env` file (example keys):

```
MONGODB_URI=mongodb://localhost:27017/skillnest-dev
SESSION_SECRET=supersecret
```

3. Run locally (full server + Socket.IO):

```powershell
npm start
# visit http://localhost:3000
```

4. Deploy to Render (recommended for Socket.IO) or Vercel (HTTP-only):

- Render: create a Web Service, build command `npm install`, start command `npm start`.
- Vercel: this repo includes `api/index.js` serverless wrapper; Socket.IO will not run on Vercel.

See `render.yaml` for an optional Render service config.

Admin registration (temporary)
-----------------------------
If you need to allow creating an admin user from the registration form temporarily, set these environment variables before starting the app:

```powershell
$env:ADMIN_REGISTRATION_ENABLED = "true"
$env:ADMIN_REGISTRATION_CODE = "your-secret-code"
```

Then, when a user selects "Admin" on the registration page they'll be prompted to provide the admin code. After you've created the admin account(s), disable this by unsetting `ADMIN_REGISTRATION_ENABLED` or setting it to `false`.

Security note: Do NOT leave admin registration enabled in production for longer than necessary. Use a secure, one-time code and rotate it after initial use.
