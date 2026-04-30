const { validationResult } = require("express-validator");
const Product = require("../models/Product");
const Category = require("../models/Category");

// ──────────────────────────────────────────
//  GET /api/products  — list with filters
// ──────────────────────────────────────────
exports.getProducts = async (req, res) => {
  try {
    const { category, brand, minPrice, maxPrice, inStock, featured, sort, page = 1, limit = 20 } = req.query;

    const filter = { isActive: true };

    if (category) filter.category = category;
    if (brand) filter.brand = new RegExp(brand, "i");
    if (inStock === "true") filter.stock = { $gt: 0 };
    if (featured === "true") filter.isFeatured = true;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    const sortMap = {
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      rating: { averageRating: -1 },
      newest: { createdAt: -1 },
      popular: { totalReviews: -1 },
    };
    const sortOption = sortMap[sort] || { createdAt: -1 };

    const skip = (Number(page) - 1) * Number(limit);

    const [products, total] = await Promise.all([
      Product.find(filter).populate("category", "name slug").sort(sortOption).skip(skip).limit(Number(limit)),
      Product.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        products,
        pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
      },
    });
  } catch (err) {
    console.error("[getProducts]", err);
    res.status(500).json({ success: false, message: "Could not fetch products." });
  }
};

// ──────────────────────────────────────────
//  GET /api/products/search?q=
// ──────────────────────────────────────────
exports.searchProducts = async (req, res) => {
  const { q, page = 1, limit = 20 } = req.query;
  if (!q) return res.status(400).json({ success: false, message: "Search query required." });

  try {
    const skip = (Number(page) - 1) * Number(limit);
    const [products, total] = await Promise.all([
      Product.find({ $text: { $search: q }, isActive: true }, { score: { $meta: "textScore" } })
        .populate("category", "name slug")
        .sort({ score: { $meta: "textScore" } })
        .skip(skip)
        .limit(Number(limit)),
      Product.countDocuments({ $text: { $search: q }, isActive: true }),
    ]);

    res.json({
      success: true,
      data: { products, total, query: q },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Search failed." });
  }
};

// ──────────────────────────────────────────
//  GET /api/products/:id
// ──────────────────────────────────────────
exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      $or: [{ _id: req.params.id.match(/^[a-f\d]{24}$/i) ? req.params.id : null }, { slug: req.params.id }],
      isActive: true,
    }).populate("category", "name slug");

    if (!product) return res.status(404).json({ success: false, message: "Product not found." });

    res.json({ success: true, data: { product } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not fetch product." });
  }
};

// ──────────────────────────────────────────
//  GET /api/products/internal/:id  (service-to-service)
// ──────────────────────────────────────────
exports.getProductInternal = async (req, res) => {
  const token = req.headers["x-internal-token"];
  if (token !== process.env.INTERNAL_SERVICE_TOKEN) {
    return res.status(403).json({ success: false, message: "Forbidden." });
  }

  try {
    const product = await Product.findById(req.params.id).select("name price discountedPrice stock images sku");
    if (!product) return res.status(404).json({ success: false, message: "Product not found." });

    res.json({ success: true, data: { product } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Internal lookup failed." });
  }
};

// ──────────────────────────────────────────
//  POST /api/products  (admin)
// ──────────────────────────────────────────
exports.createProduct = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const product = await Product.create(req.body);
    res.status(201).json({ success: true, message: "Product created.", data: { product } });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: "SKU already exists." });
    res.status(500).json({ success: false, message: "Could not create product." });
  }
};

// ──────────────────────────────────────────
//  PUT /api/products/:id  (admin)
// ──────────────────────────────────────────
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!product) return res.status(404).json({ success: false, message: "Product not found." });

    res.json({ success: true, message: "Product updated.", data: { product } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Update failed." });
  }
};

// ──────────────────────────────────────────
//  PATCH /api/products/:id/stock  (admin — internal use by order service)
// ──────────────────────────────────────────
exports.updateStock = async (req, res) => {
  const token = req.headers["x-internal-token"];
  if (token !== process.env.INTERNAL_SERVICE_TOKEN) {
    return res.status(403).json({ success: false, message: "Forbidden." });
  }

  const { quantity, operation } = req.body; // operation: 'decrement' | 'increment'

  try {
    const update = operation === "decrement"
      ? { $inc: { stock: -quantity } }
      : { $inc: { stock: quantity } };

    const product = await Product.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!product) return res.status(404).json({ success: false, message: "Product not found." });
    if (product.stock < 0) {
      // Rollback
      await Product.findByIdAndUpdate(req.params.id, { $inc: { stock: quantity } });
      return res.status(400).json({ success: false, message: "Insufficient stock." });
    }

    res.json({ success: true, data: { stock: product.stock } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Stock update failed." });
  }
};

// ──────────────────────────────────────────
//  DELETE /api/products/:id  (admin — soft delete)
// ──────────────────────────────────────────
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!product) return res.status(404).json({ success: false, message: "Product not found." });

    res.json({ success: true, message: "Product removed from catalog." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Delete failed." });
  }
};

// ──────────────────────────────────────────
//  POST /api/products/:id/reviews
// ──────────────────────────────────────────
exports.addReview = async (req, res) => {
  const { rating, comment } = req.body;
  const userId = req.headers["x-user-id"];
  const userName = req.headers["x-user-email"];

  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found." });

    const alreadyReviewed = product.reviews.some((r) => r.userId === userId);
    if (alreadyReviewed) {
      return res.status(409).json({ success: false, message: "You have already reviewed this product." });
    }

    product.reviews.push({ userId, userName, rating, comment });
    product.calculateRating();
    await product.save();

    res.status(201).json({ success: true, message: "Review added.", data: { averageRating: product.averageRating, totalReviews: product.totalReviews } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not add review." });
  }
};

// ──────────────────────────────────────────
//  Category controllers
// ──────────────────────────────────────────
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).populate("parent", "name slug");
    res.json({ success: true, data: { categories } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not fetch categories." });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const category = await Category.create(req.body);
    res.status(201).json({ success: true, message: "Category created.", data: { category } });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: "Category already exists." });
    res.status(500).json({ success: false, message: "Could not create category." });
  }
};

