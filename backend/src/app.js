const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');
const { env } = require('./config/env');
const { globalLimiter, csrfGuard } = require('./middlewares/security');
const { notFound, errorHandler } = require('./middlewares/error');
const { uploadDir } = require('./middlewares/upload');
const { asyncHandler, ok } = require('./utils/http');
const payments = require('./services/payments');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: [env.frontendUrl, ...(process.env.EXTRA_ORIGINS ? process.env.EXTRA_ORIGINS.split(',') : [])], credentials: true }));
app.use(compression());
if (process.env.NODE_ENV !== 'test') app.use(morgan(env.isProd ? 'combined' : 'dev'));
app.use(globalLimiter);

// Webhooks : corps BRUT requis pour vérifier la signature (avant express.json)
app.post('/api/payments/webhook/stripe', express.raw({ type: '*/*', limit: '1mb' }), asyncHandler(async (req, res) => ok(res, await payments.handleStripeWebhook(req.body, req.headers['stripe-signature']))));
app.post('/api/payments/webhook/mobile-money', express.raw({ type: '*/*', limit: '1mb' }), asyncHandler(async (req, res) => ok(res, await payments.handleMobileMoneyWebhook(req.body, req.headers['x-signature']))));

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(uploadDir, { maxAge: '7d', setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff') }));
app.use('/api', csrfGuard, require('./routes'));
app.use(notFound);
app.use(errorHandler);

module.exports = app;
