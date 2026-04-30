require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const orderRoutes = require("./routes/orderRoutes");

const app = express();
app.use(helmet()); app.use(cors()); app.use(morgan("dev")); app.use(express.json());

app.get("/health", (req, res) => res.json({ success: true, service: "order-service", status: "healthy" }));
app.use("/api/orders", orderRoutes);

app.use((err, req, res, next) => res.status(500).json({ success: false, message: err.message }));

const PORT = process.env.PORT || 3004;
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Order Service connected to MongoDB");
    app.listen(PORT, () => console.log(`📋 Order Service running on port ${PORT}`));
  })
  .catch((err) => { console.error("❌ MongoDB error:", err.message); process.exit(1); });

