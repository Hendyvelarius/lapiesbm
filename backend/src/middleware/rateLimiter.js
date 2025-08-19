const rateLimit = require('express-rate-limit');

// Rate limiting middleware
const createRateLimit = (windowMs = 15 * 60 * 1000, max = 100) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

// Different rate limits for different types of requests
const authLimiter = createRateLimit(15 * 60 * 1000, 50); // 5 requests per 15 minutes for auth
const generalLimiter = createRateLimit(15 * 60 * 1000, 1000); // 100 requests per 15 minutes for general API

module.exports = {
  authLimiter,
  generalLimiter,
  createRateLimit
};
