require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { createProxyMiddleware } = require("http-proxy-middleware");
const { verifyToken } = require("./middleware/auth");

const app = express();

// ──────────────────────────────────────────
//  Global Middleware
// ──────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE", "PATCH"] }));
app.use(morgan("combined"));

// Global rate limiter
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    message: { success: false, message: "Too many requests, slow down!" },
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Strict rate limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many auth attempts, try later." },
});

// ──────────────────────────────────────────
//  Health Check
// ──────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "API Gateway is running",
    timestamp: new Date().toISOString(),
    services: {
      "user-service": process.env.USER_SERVICE_URL,
      "product-service": process.env.PRODUCT_SERVICE_URL,
      "cart-service": process.env.CART_SERVICE_URL,
      "order-service": process.env.ORDER_SERVICE_URL,
      "payment-service": process.env.PAYMENT_SERVICE_URL,
    },
  });
});

// ──────────────────────────────────────────
//  Proxy helper
// ──────────────────────────────────────────
const proxy = (target, pathRewrite = {}) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite,
    on: {
      error: (err, req, res) => {
        console.error(`[Gateway] Proxy error → ${target}:`, err.message);
        res.status(502).json({ success: false, message: "Service temporarily unavailable." });
      },
    },
  });

// ──────────────────────────────────────────
//  Route Definitions
// ──────────────────────────────────────────

// USER SERVICE — public routes (no auth)
app.use(
  ["/api/users/register", "/api/users/login"],
  authLimiter,
  proxy(process.env.USER_SERVICE_URL)
);

// USER SERVICE — protected routes
app.use("/api/users", verifyToken, proxy(process.env.USER_SERVICE_URL));

// PRODUCT SERVICE — public GET routes (no auth needed for browsing)
app.use(
  ["/api/products", "/api/categories"],
  (req, res, next) => {
    // Allow GETs without auth; require auth for POST/PUT/DELETE
    if (req.method === "GET") return next();
    verifyToken(req, res, next);
  },
  proxy(process.env.PRODUCT_SERVICE_URL)
);

// CART SERVICE — always requires auth
app.use("/api/cart", verifyToken, proxy(process.env.CART_SERVICE_URL));

// ORDER SERVICE — always requires auth
app.use("/api/orders", verifyToken, proxy(process.env.ORDER_SERVICE_URL));

// PAYMENT SERVICE — always requires auth
app.use("/api/payments", verifyToken, proxy(process.env.PAYMENT_SERVICE_URL));

// ──────────────────────────────────────────
//  404 Fallback
// ──────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found.` });
});

// ──────────────────────────────────────────
//  Start
// ──────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`   USER     → ${process.env.USER_SERVICE_URL}`);
  console.log(`   PRODUCT  → ${process.env.PRODUCT_SERVICE_URL}`);
  console.log(`   CART     → ${process.env.CART_SERVICE_URL}`);
  console.log(`   ORDER    → ${process.env.ORDER_SERVICE_URL}`);
  console.log(`   PAYMENT  → ${process.env.PAYMENT_SERVICE_URL}`);
});

