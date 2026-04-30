require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const productRoutes = require("./routes/productRoutes");
const { createCategory, getCategories } = require("./controllers/productController");

const app = express();
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (req, res) => res.json({ success: true, service: "product-service", status: "healthy" }));

app.use("/api/products", productRoutes);

// Category routes
app.get("/api/categories", getCategories);
app.post("/api/categories", (req, res, next) => {
  if (req.headers["x-user-role"] !== "admin") {
    return res.status(403).json({ success: false, message: "Admin only." });
  }
  next();
}, createCategory);

app.use((err, req, res, next) => {
  console.error("[ProductService Error]", err);
  res.status(err.status || 500).json({ success: false, message: err.message || "Internal error" });
});

const PORT = process.env.PORT || 3002;
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Product Service connected to MongoDB");
    app.listen(PORT, () => console.log(`📦 Product Service running on port ${PORT}`));
  })
  .catch((err) => { console.error("❌ MongoDB error:", err.message); process.exit(1); });

