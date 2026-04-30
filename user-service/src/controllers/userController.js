const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const User = require("../models/User");

// ──────────────────────────────────────────
//  Token Generator
// ──────────────────────────────────────────
const generateToken = (user) =>
  jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

// ──────────────────────────────────────────
//  POST /api/users/register
// ──────────────────────────────────────────
exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { name, email, password, phone } = req.body;

  try {
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: "Email already registered." });
    }

    const user = await User.create({ name, email, password, phone });
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: "Registration successful!",
      data: { token, user },
    });
  } catch (err) {
    console.error("[register]", err);
    res.status(500).json({ success: false, message: "Registration failed." });
  }
};

// ──────────────────────────────────────────
//  POST /api/users/login
// ──────────────────────────────────────────
exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email, isActive: true }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);

    res.json({
      success: true,
      message: "Login successful!",
      data: { token, user },
    });
  } catch (err) {
    console.error("[login]", err);
    res.status(500).json({ success: false, message: "Login failed." });
  }
};

// ──────────────────────────────────────────
//  GET /api/users/profile
// ──────────────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    res.json({ success: true, data: { user } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not fetch profile." });
  }
};

// ──────────────────────────────────────────
//  PUT /api/users/profile
// ──────────────────────────────────────────
exports.updateProfile = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { name, phone } = req.body;

  try {
    const user = await User.findByIdAndUpdate(
      req.userId,
      { name, phone },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    res.json({ success: true, message: "Profile updated.", data: { user } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Update failed." });
  }
};

// ──────────────────────────────────────────
//  POST /api/users/addresses
// ──────────────────────────────────────────
exports.addAddress = async (req, res) => {
  const { street, city, state, pincode, country, isDefault } = req.body;

  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    // If new address is default, unset existing defaults
    if (isDefault) {
      user.addresses.forEach((addr) => (addr.isDefault = false));
    }

    user.addresses.push({ street, city, state, pincode, country, isDefault });
    await user.save();

    res.status(201).json({ success: true, message: "Address added.", data: { addresses: user.addresses } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not add address." });
  }
};

// ──────────────────────────────────────────
//  DELETE /api/users/addresses/:addressId
// ──────────────────────────────────────────
exports.removeAddress = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    user.addresses = user.addresses.filter(
      (addr) => addr._id.toString() !== req.params.addressId
    );
    await user.save();

    res.json({ success: true, message: "Address removed.", data: { addresses: user.addresses } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not remove address." });
  }
};

// ──────────────────────────────────────────
//  GET /api/users/:id  (internal — called by other services)
// ──────────────────────────────────────────
exports.getUserById = async (req, res) => {
  const internalToken = req.headers["x-internal-token"];
  if (internalToken !== process.env.INTERNAL_SERVICE_TOKEN) {
    return res.status(403).json({ success: false, message: "Forbidden." });
  }

  try {
    const user = await User.findById(req.params.id).select("name email phone");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    res.json({ success: true, data: { user } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not fetch user." });
  }
};

// ──────────────────────────────────────────
//  GET /api/users  (admin only)
// ──────────────────────────────────────────
exports.getAllUsers = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  try {
    const [users, total] = await Promise.all([
      User.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(),
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not fetch users." });
  }
};

