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

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { success: false, message: "Too many requests, slow down!" },
    standardHeaders: true,
    legacyHeaders: false,
  })
);

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
//  Route Definitions
// ──────────────────────────────────────────

// USER SERVICE
app.use(
  "/api/users",
  (req, res, next) => {
    const publicPaths = ["/register", "/login"];
    const isPublic = publicPaths.some(p => req.path === p && req.method === "POST");
    if (isPublic) return authLimiter(req, res, next);
    return verifyToken(req, res, next);
  },
  createProxyMiddleware({
    target: process.env.USER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path, req) => req.originalUrl,
    on: {
      error: (err, req, res) => {
        console.error("[Gateway] user-service error:", err.message);
        res.status(502).json({ success: false, message: "User service unavailable." });
      },
    },
  })
);

// PRODUCT SERVICE
app.use(
  "/api/products",
  (req, res, next) => {
    if (req.method === "GET") return next();
    verifyToken(req, res, next);
  },
  createProxyMiddleware({
    target: process.env.PRODUCT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path, req) => req.originalUrl,
    on: {
      error: (err, req, res) => {
        console.error("[Gateway] product-service error:", err.message);
        res.status(502).json({ success: false, message: "Product service unavailable." });
      },
    },
  })
);

// CATEGORIES
app.use(
  "/api/categories",
  (req, res, next) => {
    if (req.method === "GET") return next();
    verifyToken(req, res, next);
  },
  createProxyMiddleware({
    target: process.env.PRODUCT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path, req) => req.originalUrl,
    on: {
      error: (err, req, res) => {
        console.error("[Gateway] product-service error:", err.message);
        res.status(502).json({ success: false, message: "Product service unavailable." });
      },
    },
  })
);

// CART SERVICE
app.use(
  "/api/cart",
  verifyToken,
  createProxyMiddleware({
    target: process.env.CART_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path, req) => req.originalUrl,
    on: {
      error: (err, req, res) => {
        console.error("[Gateway] cart-service error:", err.message);
        res.status(502).json({ success: false, message: "Cart service unavailable." });
      },
    },
  })
);

// ORDER SERVICE
app.use(
  "/api/orders",
  verifyToken,
  createProxyMiddleware({
    target: process.env.ORDER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path, req) => req.originalUrl,
    on: {
      error: (err, req, res) => {
        console.error("[Gateway] order-service error:", err.message);
        res.status(502).json({ success: false, message: "Order service unavailable." });
      },
    },
  })
);

// PAYMENT SERVICE
app.use(
  "/api/payments",
  verifyToken,
  createProxyMiddleware({
    target: process.env.PAYMENT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path, req) => req.originalUrl,
    on: {
      error: (err, req, res) => {
        console.error("[Gateway] payment-service error:", err.message);
        res.status(502).json({ success: false, message: "Payment service unavailable." });
      },
    },
  })
);

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
