require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cartRoutes = require("./routes/cartRoutes");

const app = express();
app.use(helmet()); app.use(cors()); app.use(morgan("dev")); app.use(express.json());

app.get("/health", (req, res) => res.json({ success: true, service: "cart-service", status: "healthy" }));
app.use("/api/cart", cartRoutes);

app.use((err, req, res, next) => res.status(500).json({ success: false, message: err.message }));

const PORT = process.env.PORT || 3003;
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Cart Service connected to MongoDB");
    app.listen(PORT, () => console.log(`🛒 Cart Service running on port ${PORT}`));
  })
  .catch((err) => { console.error("❌ MongoDB error:", err.message); process.exit(1); });

