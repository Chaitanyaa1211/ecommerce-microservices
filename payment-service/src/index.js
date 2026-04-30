require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();
app.use(helmet()); app.use(cors()); app.use(morgan("dev")); app.use(express.json());

app.get("/health", (req, res) => res.json({ success: true, service: "payment-service", status: "healthy" }));
app.use("/api/payments", paymentRoutes);

app.use((err, req, res, next) => res.status(500).json({ success: false, message: err.message }));

const PORT = process.env.PORT || 3005;
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Payment Service connected to MongoDB");
    app.listen(PORT, () => console.log(`💳 Payment Service running on port ${PORT}`));
  })
  .catch((err) => { console.error("❌ MongoDB error:", err.message); process.exit(1); });

