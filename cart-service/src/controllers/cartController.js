const axios = require("axios");
const Cart = require("../models/Cart");

const PRODUCT_SERVICE = process.env.PRODUCT_SERVICE_URL;
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;

// Helper: Fetch product from product-service
const fetchProduct = async (productId) => {
  const { data } = await axios.get(`${PRODUCT_SERVICE}/api/products/internal/${productId}`, {
    headers: { "x-internal-token": INTERNAL_TOKEN },
  });
  return data.data.product;
};

// ──────────────────────────────────────────
//  GET /api/cart
// ──────────────────────────────────────────
exports.getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.userId });
    if (!cart) {
      return res.json({ success: true, data: { cart: { items: [], totalItems: 0, totalPrice: 0 } } });
    }
    res.json({ success: true, data: { cart } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not fetch cart." });
  }
};

// ──────────────────────────────────────────
//  POST /api/cart/add
// ──────────────────────────────────────────
exports.addToCart = async (req, res) => {
  const { productId, quantity = 1 } = req.body;

  if (!productId) return res.status(400).json({ success: false, message: "productId is required." });
  if (quantity < 1) return res.status(400).json({ success: false, message: "Quantity must be at least 1." });

  try {
    // Validate product exists and has stock
    const product = await fetchProduct(productId);
    if (!product) return res.status(404).json({ success: false, message: "Product not found." });
    if (product.stock < quantity) {
      return res.status(400).json({ success: false, message: `Only ${product.stock} units in stock.` });
    }

    const effectivePrice = product.discountedPrice || product.price;

    let cart = await Cart.findOne({ userId: req.userId });

    if (!cart) {
      cart = new Cart({ userId: req.userId, items: [] });
    }

    // Check if product already in cart
    const existingItem = cart.items.find((i) => i.productId === productId);

    if (existingItem) {
      const newQty = existingItem.quantity + quantity;
      if (newQty > product.stock) {
        return res.status(400).json({
          success: false,
          message: `You already have ${existingItem.quantity} in cart. Only ${product.stock} available.`,
        });
      }
      existingItem.quantity = newQty;
      existingItem.subtotal = parseFloat((effectivePrice * newQty).toFixed(2));
    } else {
      cart.items.push({
        productId,
        name: product.name,
        price: effectivePrice,
        image: product.images?.[0] || "",
        quantity,
        subtotal: parseFloat((effectivePrice * quantity).toFixed(2)),
      });
    }

    await cart.save();
    res.status(200).json({ success: true, message: "Item added to cart.", data: { cart } });
  } catch (err) {
    console.error("[addToCart]", err.message);
    if (err.response?.status === 404) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }
    res.status(500).json({ success: false, message: "Could not add to cart." });
  }
};

// ──────────────────────────────────────────
//  PUT /api/cart/update
// ──────────────────────────────────────────
exports.updateCartItem = async (req, res) => {
  const { productId, quantity } = req.body;

  if (!productId || quantity === undefined) {
    return res.status(400).json({ success: false, message: "productId and quantity required." });
  }
  if (quantity < 1) return res.status(400).json({ success: false, message: "Quantity must be >= 1." });

  try {
    const product = await fetchProduct(productId);
    if (product.stock < quantity) {
      return res.status(400).json({ success: false, message: `Only ${product.stock} units available.` });
    }

    const cart = await Cart.findOne({ userId: req.userId });
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found." });

    const item = cart.items.find((i) => i.productId === productId);
    if (!item) return res.status(404).json({ success: false, message: "Item not in cart." });

    item.quantity = quantity;
    item.subtotal = parseFloat((item.price * quantity).toFixed(2));

    await cart.save();
    res.json({ success: true, message: "Cart updated.", data: { cart } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not update cart." });
  }
};

// ──────────────────────────────────────────
//  DELETE /api/cart/remove/:productId
// ──────────────────────────────────────────
exports.removeFromCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.userId });
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found." });

    cart.items = cart.items.filter((i) => i.productId !== req.params.productId);
    await cart.save();

    res.json({ success: true, message: "Item removed.", data: { cart } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not remove item." });
  }
};

// ──────────────────────────────────────────
//  DELETE /api/cart/clear
// ──────────────────────────────────────────
exports.clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.userId });
    if (!cart) return res.json({ success: true, message: "Cart already empty." });

    cart.items = [];
    await cart.save();

    res.json({ success: true, message: "Cart cleared." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not clear cart." });
  }
};

// ──────────────────────────────────────────
//  GET /api/cart/internal/:userId  (order service calls this)
// ──────────────────────────────────────────
exports.getCartInternal = async (req, res) => {
  const token = req.headers["x-internal-token"];
  if (token !== INTERNAL_TOKEN) {
    return res.status(403).json({ success: false, message: "Forbidden." });
  }

  try {
    const cart = await Cart.findOne({ userId: req.params.userId });
    res.json({ success: true, data: { cart: cart || { items: [], totalPrice: 0 } } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Internal cart lookup failed." });
  }
};

// ──────────────────────────────────────────
//  DELETE /api/cart/internal/:userId  (called by order service after order placed)
// ──────────────────────────────────────────
exports.clearCartInternal = async (req, res) => {
  const token = req.headers["x-internal-token"];
  if (token !== INTERNAL_TOKEN) {
    return res.status(403).json({ success: false, message: "Forbidden." });
  }

  try {
    await Cart.findOneAndUpdate({ userId: req.params.userId }, { items: [], totalItems: 0, totalPrice: 0 });
    res.json({ success: true, message: "Cart cleared after order." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Internal clear failed." });
  }
};

