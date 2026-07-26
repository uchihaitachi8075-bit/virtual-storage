// This file wires everything together: middleware, routes, error handling.
// server.js (separate file) is what actually starts listening on a port —
// splitting them makes it easy to import `app` in automated tests later
// without starting a real network server.

const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes = require('./routes/auth.routes');
const fileRoutes = require('./routes/file.routes');
const userRoutes = require('./routes/user.routes');
const { downloadSharedFile } = require('./controllers/file.controller');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors()); // allows a future separate frontend (e.g. React on another port) to call this API
app.use(morgan('dev')); // logs each incoming request to the console — handy while developing
app.use(express.json()); // parses JSON request bodies into req.body

// Serves public/index.html (the browser file-manager UI) at http://localhost:4000
// Since it's the same origin as the API, no CORS complications for the browser.
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (req, res) => res.json({ success: true, status: 'ok' }));

app.use('/auth', authRoutes);
app.use('/files', fileRoutes);
app.use('/user', userRoutes);

// Public route for shared links — intentionally OUTSIDE /files so it never
// picks up the requireAuth middleware applied inside file.routes.js.
app.get('/share/:token', downloadSharedFile);

// Catch-all for unknown routes.
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Must be registered LAST — see middleware/errorHandler.js for why.
app.use(errorHandler);

module.exports = app;
