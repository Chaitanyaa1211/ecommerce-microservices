require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const userRoutes = require("./routes/userRoutes");

const app = express();

// ──────────────────────────────────────────
//  Middleware
// ──────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

// ──────────────────────────────────────────
//  Health Check
// ──────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ success: true, service: "user-service", status: "healthy" });
});

// ──────────────────────────────────────────
//  Routes
// ──────────────────────────────────────────
app.use("/api/users", userRoutes);

// ──────────────────────────────────────────
//  Global Error Handler
// ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("[UserService Error]", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

// ──────────────────────────────────────────
//  Database + Start
// ──────────────────────────────────────────
const PORT = process.env.PORT || 3001;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ User Service connected to MongoDB");
    app.listen(PORT, () => console.log(`👤 User Service running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

