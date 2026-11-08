import mongoose from "mongoose";
import { sendEmail } from "./emailAdapter.js";
import Notification from "../models/Notification.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";

/**
 * Masks an email address for safe client-side display.
 * Example: 'john.doe@example.com' -> 'j***e@example.com'
 *
 * @param {string} email
 * @returns {string} Masked email string
 */
export function maskEmail(email) {
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return "***";
  }

  const [local, domain] = email.split("@");
  if (!local || !domain) {
    return "***";
  }

  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }

  const firstChar = local[0];
  const lastChar = local[local.length - 1];
  return `${firstChar}***${lastChar}@${domain}`;
}

/**
 * Dispatches a 6-digit checkout OTP verification email to the user.
 *
 * @param {Object} params
 * @param {string} params.toEmail Authenticated user email
 * @param {string} params.otpCode 6-digit verification code
 * @returns {Promise<{ success: boolean, messageId?: string }>}
 */
export async function sendOtpNotification({ toEmail, otpCode }) {
  if (!toEmail || !otpCode) {
    throw new Error("Recipient email and OTP code are required");
  }

  const subject = "GreenCart — Your Checkout Verification Code";

  const textContent = `Your GreenCart verification code is: ${otpCode}. This code is valid for 5 minutes. Do not share this code with anyone.`;

  const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 24px;">
                <h2 style="color: #16a34a; margin: 0; font-size: 24px; font-weight: bold;">GreenCart</h2>
                <p style="color: #6b7280; margin: 4px 0 0 0; font-size: 14px;">Cash On Delivery Verification</p>
            </div>
            <p style="color: #374151; font-size: 15px; line-height: 1.5; margin-bottom: 16px;">
                Please use the following 6-digit verification code to confirm your order checkout:
            </p>
            <div style="text-align: center; margin: 24px 0;">
                <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111827; background-color: #f3f4f6; padding: 12px 24px; border-radius: 6px; border: 1px dashed #d1d5db;">
                    ${otpCode}
                </span>
            </div>
            <p style="color: #4b5563; font-size: 13px; line-height: 1.5; margin-bottom: 8px;">
                ⏱ <strong>This code expires in 5 minutes.</strong>
            </p>
            <p style="color: #6b7280; font-size: 12px; line-height: 1.4; margin-top: 16px; border-top: 1px solid #f3f4f6; padding-top: 12px;">
                If you did not request this verification code, please ignore this email or contact support immediately. Never share your verification code with anyone.
            </p>
        </div>
    `;

  return await sendEmail({
    toEmail,
    subject,
    htmlContent,
    textContent,
    code: otpCode,
  });
}

/**
 * Dispatches an order confirmation email to the buyer after successful checkout.
 * Optionally attaches a generated invoice PDF Buffer when provided.
 *
 * @param {Object} params
 * @param {string} params.toEmail Verified buyer email address
 * @param {string|Object} params.orderId Persisted order ID
 * @param {string} [params.orderNumber] Public order number (e.g. 'GC-K7M2Q9')
 * @param {number|string} params.totalAmount Authoritative order total
 * @param {Buffer} [params.invoicePdfBuffer] Optional in-memory PDF Buffer of the tax invoice
 * @param {Buffer} [maybeInvoicePdfBuffer] Optional in-memory PDF Buffer passed as second positional argument
 * @returns {Promise<{ success: boolean, messageId?: string }>}
 */
export async function sendOrderConfirmationNotification(
  params,
  maybeInvoicePdfBuffer
) {
  if (!params || typeof params !== "object") {
    throw new Error("Order confirmation parameters object is required");
  }

  const {
    toEmail,
    orderId,
    orderNumber,
    totalAmount,
    invoicePdfBuffer: paramBuffer
  } = params;

  if (!toEmail || typeof toEmail !== "string" || !toEmail.includes("@")) {
    throw new Error("Valid recipient email is required");
  }
  if (!orderId) {
    throw new Error("Valid order ID is required");
  }
  if (
    totalAmount === undefined ||
    totalAmount === null ||
    !Number.isFinite(Number(totalAmount))
  ) {
    throw new Error("Valid order total amount is required");
  }

  const cleanOrderId = String(orderId).trim();
  const displayOrderId =
    orderNumber && typeof orderNumber === "string" && orderNumber.trim()
      ? orderNumber.trim()
      : cleanOrderId;
  const formattedAmount = String(totalAmount).trim();

  // Validate and prepare optional invoice PDF attachment
  const invoicePdfBuffer = maybeInvoicePdfBuffer !== undefined ? maybeInvoicePdfBuffer : paramBuffer;
  const attachments = [];

  if (invoicePdfBuffer !== undefined && invoicePdfBuffer !== null) {
    if (!Buffer.isBuffer(invoicePdfBuffer)) {
      throw new Error("Invalid invoice PDF: invoicePdfBuffer must be a Buffer instance");
    }
    if (invoicePdfBuffer.length === 0) {
      throw new Error("Invalid invoice PDF: PDF buffer cannot be empty");
    }
    if (invoicePdfBuffer.length > 5 * 1024 * 1024) {
      throw new Error(`Invalid invoice PDF: attachment exceeds 5 MB limit (${invoicePdfBuffer.length} bytes)`);
    }
    const signature = invoicePdfBuffer.subarray(0, 5).toString('ascii');
    if (signature !== '%PDF-') {
      throw new Error("Invalid invoice PDF: buffer does not begin with standard %PDF- signature");
    }

    // Sanitize display identifier for filename: remove path separators and illegal characters
    const safeOrderIdentifier = displayOrderId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const attachmentName = `Invoice-${safeOrderIdentifier || 'Order'}.pdf`;

    attachments.push({
      name: attachmentName,
      content: invoicePdfBuffer,
      contentType: 'application/pdf'
    });
  }

  const subject = "GreenCart — Order Confirmation";

  const textContent = `💚 প্রিয় গ্রাহক, GreenCart-এর সঙ্গে থাকার জন্য আপনাকে আন্তরিক ধন্যবাদ!

🎉 আনন্দের সঙ্গে জানাচ্ছি, আপনার অর্ডারটি #${displayOrderId} সফলভাবে গ্রহণ করা হয়েছে।

🛍️ অর্ডারের মোট মূল্য: ৳${formattedAmount}

আপনার অর্ডারের পরবর্তী আপডেট পেতে আমাদের সঙ্গে থাকুন। আপনার কেনাকাটার অভিজ্ঞতা হোক সহজ, আনন্দময় ও নির্ভরযোগ্য।

GreenCart — আপনার পছন্দ, আমাদের যত্ন। 💚`;

  const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 24px;">
                <h2 style="color: #16a34a; margin: 0; font-size: 24px; font-weight: bold;">GreenCart</h2>
                <p style="color: #6b7280; margin: 4px 0 0 0; font-size: 14px;">Order Confirmation</p>
            </div>
            <p style="color: #374151; font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
                💚 প্রিয় গ্রাহক, GreenCart-এর সঙ্গে থাকার জন্য আপনাকে আন্তরিক ধন্যবাদ!
            </p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
                🎉 আনন্দের সঙ্গে জানাচ্ছি, আপনার অর্ডারটি <strong>#${displayOrderId}</strong> সফলভাবে গ্রহণ করা হয়েছে।
            </p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
                🛍️ অর্ডারের মোট মূল্য: <strong>৳${formattedAmount}</strong>
            </p>
            <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
                আপনার অর্ডারের পরবর্তী আপডেট পেতে আমাদের সঙ্গে থাকুন। আপনার কেনাকাটার অভিজ্ঞতা হোক সহজ, আনন্দময় ও নির্ভরযোগ্য।
            </p>
            <p style="color: #16a34a; font-size: 14px; font-weight: bold; line-height: 1.6; margin-bottom: 16px;">
                GreenCart — আপনার পছন্দ, আমাদের যত্ন। 💚
            </p>
            <div style="background-color: #f3f4f6; padding: 16px; border-radius: 6px; margin: 20px 0; border: 1px solid #e5e7eb;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="color: #6b7280; font-size: 14px;">অর্ডার আইডি:</span>
                    <span style="color: #111827; font-weight: bold; font-family: monospace; font-size: 14px;">#${displayOrderId}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #6b7280; font-size: 14px;">মোট মূল্য:</span>
                    <span style="color: #16a34a; font-weight: bold; font-size: 16px;">৳${formattedAmount}</span>
                </div>
            </div>
            <p style="color: #6b7280; font-size: 12px; line-height: 1.4; margin-top: 16px; border-top: 1px solid #f3f4f6; padding-top: 12px;">
                If you have any questions about your order, please contact our support team.
            </p>
        </div>
    `;

  return await sendEmail({
    toEmail: toEmail.trim(),
    subject,
    htmlContent,
    textContent,
    ...(attachments.length > 0 ? { attachments } : {})
  });
}

// =============================================================================
// Smart Notification Center — In-App Event Services & Deduplication
// =============================================================================

/**
 * Safely inspects whether a Mongoose model method can be invoked without hanging,
 * supporting both live MongoDB connections and mocked unit-test harnesses.
 */
export const isModelRunnable = (model, method = 'find') => {
  if (!model || typeof model[method] !== 'function') return false;
  const fnStr = model[method].toString();
  const isNativeMongoose =
    fnStr.startsWith('function findOne(') ||
    fnStr.startsWith('async function create(') ||
    fnStr.startsWith('function find(') ||
    fnStr.startsWith('function countDocuments(') ||
    fnStr.startsWith('function findOneAndUpdate(') ||
    fnStr.startsWith('function updateMany(') ||
    fnStr.startsWith('function findOneAndDelete(');
  if (!isNativeMongoose) {
    return true;
  }
  return !!(mongoose.connection && mongoose.connection.readyState === 1 && mongoose.connection.db);
};

/**
 * Base notification creator with built-in deduplication & validation.
 */
export const createNotification = async ({
  sellerId = null,
  recipientRoles = ['Admin', 'CEO', 'CTO', 'Strategist'],
  type,
  title,
  message,
  data = {},
  dedupeKey = null
}) => {
  if (!type || !title || !message) return null;
  if (!isModelRunnable(Notification, 'findOne') || !isModelRunnable(Notification, 'create')) {
    return null;
  }

  try {
    if (dedupeKey) {
      const existing = await Notification.findOne({ dedupeKey });
      if (existing) {
        return existing;
      }
    }

    const notificationData = {
      sellerId: sellerId ? String(sellerId) : null,
      recipientRoles: Array.isArray(recipientRoles) ? recipientRoles : ['Admin', 'CEO', 'CTO', 'Strategist'],
      type,
      title: String(title).trim(),
      message: String(message).trim(),
      data: data && typeof data === 'object' ? data : {},
      dedupeKey: dedupeKey ? String(dedupeKey).trim() : null
    };

    const created = await Notification.create(notificationData);
    return created;
  } catch (err) {
    console.error("createNotification error:", err.message);
    return null;
  }
};

/**
 * 1. New Order Alert
 * Notifies Admin/CEO/CTO (store-wide) and the relevant Seller when a new qualifying order is placed.
 */
export const notifyNewOrder = async ({ order, customerName = 'Customer', address = null }) => {
  if (!order?._id) return [];

  const orderIdStr = String(order._id);
  const orderNumber = order.orderNumber || orderIdStr;
  const amount = typeof order.amount === 'number' ? order.amount : 0;
  const customer = (customerName || (address ? `${address.firstName || ''} ${address.lastName || ''}`.trim() : '') || 'Customer').trim();

  const createdNotifications = [];

  // Store-Wide Admin Notification
  const adminNotif = await createNotification({
    sellerId: null,
    recipientRoles: ['Admin', 'CEO', 'CTO'],
    type: 'order',
    title: `New Order Alert: #${orderNumber}`,
    message: `New order of ৳${amount.toLocaleString()} placed by ${customer}. Order #${orderNumber}.`,
    data: {
      orderId: orderIdStr,
      orderNumber,
      customerName: customer,
      amount,
      link: '/seller/orders'
    },
    dedupeKey: `new_order:${orderIdStr}:admin`
  });
  if (adminNotif) createdNotifications.push(adminNotif);

  // Identify distinct tenant sellers who have items in this order
  const sellerIds = new Set();
  if (Array.isArray(order.items)) {
    for (const item of order.items) {
      if (item.sellerId && String(item.sellerId) !== 'null' && String(item.sellerId) !== 'undefined') {
        sellerIds.add(String(item.sellerId));
      }
    }

    // If items don't have sellerId embedded, look them up from Product
    if (sellerIds.size === 0 && isModelRunnable(Product, 'find')) {
      const prodIds = order.items.map(it => it.product).filter(Boolean);
      if (prodIds.length > 0) {
        try {
          const products = await Product.find({ _id: { $in: prodIds } }).select('sellerId').lean();
          for (const p of products) {
            if (p.sellerId) sellerIds.add(String(p.sellerId));
          }
        } catch (_) {}
      }
    }
  }

  // Notify each distinct tenant seller
  for (const sellerId of sellerIds) {
    const sellerNotif = await createNotification({
      sellerId,
      recipientRoles: ['Admin', 'CEO', 'CTO', 'Strategist'],
      type: 'order',
      title: `New Order Alert: #${orderNumber}`,
      message: `A customer ordered items from your store in order #${orderNumber}.`,
      data: {
        orderId: orderIdStr,
        orderNumber,
        customerName: customer,
        amount,
        link: '/seller/orders'
      },
      dedupeKey: `new_order:${orderIdStr}:seller:${sellerId}`
    });
    if (sellerNotif) createdNotifications.push(sellerNotif);
  }

  return createdNotifications;
};

/**
 * Resets active low-stock deduplication keys when a product is restocked above its threshold,
 * enabling future transitions back into low-stock to emit new alerts while preserving past records.
 */
export const resetLowStockDeduplication = async (productId, sellerId = null) => {
  if (!productId) return;
  const productIdStr = String(productId);
  if (!isModelRunnable(Notification, 'updateMany')) return;

  const keysToClear = [`low_stock:${productIdStr}:admin`];
  if (sellerId) {
    keysToClear.push(`low_stock:${productIdStr}:seller:${String(sellerId)}`);
  }
  await Notification.updateMany(
    { type: 'low_stock', dedupeKey: { $in: keysToClear } },
    { $set: { dedupeKey: null } }
  );
};

/**
 * 2. Low Stock Alert
 * Triggered when a product's stock reaches or falls below its configured lowStockThreshold.
 */
export const notifyLowStock = async ({ product, currentStock, threshold = 5 }) => {
  if (!product?._id) return [];

  const productIdStr = String(product._id);
  const prodName = product.name || 'Product';
  const stock = typeof currentStock === 'number' ? currentStock : (product.stockQuantity || 0);
  const effThreshold = typeof threshold === 'number' && threshold >= 1 ? threshold : (product.lowStockThreshold || 5);
  const sellerId = product.sellerId ? String(product.sellerId) : null;

  if (stock > effThreshold) {
    // Product is restocked above threshold. Reset dedupe keys so future drops generate alerts.
    await resetLowStockDeduplication(productIdStr, sellerId);
    return []; // Stock is healthy, no alert needed
  }

  const isZero = stock === 0;
  const title = isZero
    ? `Out of Stock: ${prodName}`
    : `Low Stock Alert: ${prodName}`;

  const message = isZero
    ? `Product "${prodName}" is completely out of stock (0 items remaining).`
    : `Product "${prodName}" has fallen to ${stock} units remaining (threshold: ${effThreshold}).`;

  // Deduplication key: one per product while in low stock condition
  const dedupeKeyAdmin = `low_stock:${productIdStr}:admin`;
  const dedupeKeySeller = sellerId ? `low_stock:${productIdStr}:seller:${sellerId}` : null;

  const notifications = [];

  // Store Admin Notification
  const adminNotif = await createNotification({
    sellerId: null,
    recipientRoles: ['Admin', 'CTO', 'Strategist'],
    type: 'low_stock',
    title,
    message,
    data: {
      productId: productIdStr,
      productName: prodName,
      stockQuantity: stock,
      lowStockThreshold: effThreshold,
      link: '/seller/product-list'
    },
    dedupeKey: dedupeKeyAdmin
  });
  if (adminNotif) notifications.push(adminNotif);

  // Tenant Seller Notification if applicable
  if (sellerId) {
    const sellerNotif = await createNotification({
      sellerId,
      recipientRoles: ['Admin', 'CTO', 'Strategist'],
      type: 'low_stock',
      title,
      message,
      data: {
        productId: productIdStr,
        productName: prodName,
        stockQuantity: stock,
        lowStockThreshold: effThreshold,
        link: '/seller/product-list'
      },
      dedupeKey: dedupeKeySeller
    });
    if (sellerNotif) notifications.push(sellerNotif);
  }

  return notifications;
};

/**
 * 3. New Customer Alert
 * Notify when a new customer is first added to the Customer Directory through a qualifying order.
 */
export const notifyNewCustomer = async ({ customer, order, sellerId = null }) => {
  if (!customer?.email && !customer?.name) return [];

  const custName = customer.name || 'New Customer';
  const custEmail = customer.email || '';
  const custPhone = customer.phone || '';
  const custUserId = customer.userId ? String(customer.userId) : null;
  const orderIdStr = order?._id ? String(order._id) : null;
  const orderNumber = order?.orderNumber || orderIdStr || 'N/A';

  const identifier = custUserId || custEmail.toLowerCase();
  const notifications = [];

  const title = `New Customer Added: ${custName}`;
  const message = `Customer ${custName}${custEmail ? ` (${custEmail})` : ''} joined the customer directory via order #${orderNumber}.`;

  // Admin Notification
  const adminNotif = await createNotification({
    sellerId: null,
    recipientRoles: ['Admin', 'CEO', 'CTO', 'Strategist'],
    type: 'new_customer',
    title,
    message,
    data: {
      customerId: custUserId,
      customerName: custName,
      customerEmail: custEmail,
      customerPhone: custPhone,
      orderId: orderIdStr,
      link: '/seller/contacts'
    },
    dedupeKey: `new_customer:${identifier}:admin`
  });
  if (adminNotif) notifications.push(adminNotif);

  // Specific Seller Notification if applicable
  if (sellerId) {
    const sellerNotif = await createNotification({
      sellerId: String(sellerId),
      recipientRoles: ['Admin', 'CEO', 'CTO', 'Strategist'],
      type: 'new_customer',
      title,
      message,
      data: {
        customerId: custUserId,
        customerName: custName,
        customerEmail: custEmail,
        customerPhone: custPhone,
        orderId: orderIdStr,
        link: '/seller/contacts'
      },
      dedupeKey: `new_customer:${identifier}:seller:${sellerId}`
    });
    if (sellerNotif) notifications.push(sellerNotif);
  }

  return notifications;
};

/**
 * 4. Pending Order Reminder
 * Scans qualifying orders that have been pending beyond a reasonable period (default 24h).
 */
export const notifyPendingOrderReminder = async ({ order, hoursPending = 24, sellerId = null }) => {
  if (!order?._id) return [];

  const orderIdStr = String(order._id);
  const orderNumber = order.orderNumber || orderIdStr;
  const amount = typeof order.amount === 'number' ? order.amount : 0;

  // Daily bucket to enforce reminder interval (one reminder per order per 24-hour day)
  const dayBucket = Math.floor(Date.now() / (24 * 60 * 60 * 1000));

  const title = `Pending Order Reminder: #${orderNumber}`;
  const message = `Order #${orderNumber} (৳${amount.toLocaleString()}) has been awaiting fulfillment for ${Math.floor(hoursPending)} hours.`;

  const notifications = [];

  // Admin Reminder
  const adminNotif = await createNotification({
    sellerId: null,
    recipientRoles: ['Admin', 'CEO', 'CTO'],
    type: 'pending_reminder',
    title,
    message,
    data: {
      orderId: orderIdStr,
      orderNumber,
      amount,
      link: '/seller/orders'
    },
    dedupeKey: `pending_reminder:${orderIdStr}:admin:${dayBucket}`
  });
  if (adminNotif) notifications.push(adminNotif);

  // Seller Reminder if applicable
  if (sellerId) {
    const sellerNotif = await createNotification({
      sellerId: String(sellerId),
      recipientRoles: ['Admin', 'CEO', 'CTO'],
      type: 'pending_reminder',
      title,
      message,
      data: {
        orderId: orderIdStr,
        orderNumber,
        amount,
        link: '/seller/orders'
      },
      dedupeKey: `pending_reminder:${orderIdStr}:seller:${sellerId}:${dayBucket}`
    });
    if (sellerNotif) notifications.push(sellerNotif);
  }

  return notifications;
};

/**
 * 5. Important System Notifications
 * Handles system-level security events, operational notices, and administrative announcements.
 */
export const notifySystemEvent = async ({
  title,
  message,
  sellerId = null,
  recipientRoles = ['Admin', 'CEO', 'CTO', 'Strategist'],
  data = {},
  dedupeKey = null
}) => {
  return createNotification({
    sellerId,
    recipientRoles,
    type: 'system',
    title,
    message,
    data,
    dedupeKey
  });
};

/**
 * Background / In-Request Scanner for Pending Orders
 * Throttled in-memory so it only scans at most once every 15 minutes per server process.
 */
let lastPendingCheckTimestamp = 0;
const PENDING_SCAN_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

export const checkPendingOrderReminders = async ({
  pendingThresholdHours = 24,
  force = false
} = {}) => {
  const now = Date.now();
  if (!force && (now - lastPendingCheckTimestamp < PENDING_SCAN_COOLDOWN_MS)) {
    return { scanned: 0, reminded: 0, skipped: true };
  }
  lastPendingCheckTimestamp = now;

  if (!isModelRunnable(Order, 'find')) {
    return { scanned: 0, reminded: 0, offline: true };
  }

  try {
    const cutoff = new Date(now - (pendingThresholdHours * 60 * 60 * 1000));
    const pendingOrders = await Order.find({
      status: { $in: ["Order Placed", "Packing"] },
      createdAt: { $lte: cutoff }
    }).lean();

    let remindedCount = 0;
    for (const order of pendingOrders) {
      const orderCreatedAt = new Date(order.createdAt).getTime();
      const hoursPending = (now - orderCreatedAt) / (60 * 60 * 1000);

      // Notify Admin
      const adminNotifs = await notifyPendingOrderReminder({ order, hoursPending, sellerId: null });
      if (adminNotifs && adminNotifs.length > 0) remindedCount += adminNotifs.length;

      // Notify each seller involved in the order
      const sellerIds = new Set();
      if (Array.isArray(order.items)) {
        for (const it of order.items) {
          if (it.sellerId) sellerIds.add(String(it.sellerId));
        }
      }
      for (const sId of sellerIds) {
        const sNotifs = await notifyPendingOrderReminder({ order, hoursPending, sellerId: sId });
        if (sNotifs && sNotifs.length > 0) remindedCount += sNotifs.length;
      }
    }

    return { scanned: pendingOrders.length, reminded: remindedCount, success: true };
  } catch (err) {
    console.error("checkPendingOrderReminders error:", err.message);
    return { scanned: 0, reminded: 0, error: err.message };
  }
};

let pendingReminderTimer = null;

/**
 * Automatically schedules periodic background scans for pending orders in production.
 * Uses native Node.js setInterval with unref() to ensure non-blocking background execution.
 *
 * @param {number} intervalMs Scan interval in milliseconds (default: 1 hour)
 * @returns {NodeJS.Timeout|null}
 */
export const startPendingOrderScheduler = (intervalMs = 60 * 60 * 1000) => {
  if (pendingReminderTimer) return pendingReminderTimer;
  if (process.env.NODE_ENV === 'test') return null;

  const runScanner = async () => {
    try {
      if (mongoose.connection?.readyState === 1 && mongoose.connection?.db) {
        await checkPendingOrderReminders();
      }
    } catch (err) {
      console.error("Scheduled pending order scan error:", err.message);
    }
  };

  // Run initial scan after 30 seconds to allow full application boot
  const initialTimeout = setTimeout(runScanner, 30000);
  if (typeof initialTimeout?.unref === 'function') {
    initialTimeout.unref();
  }

  pendingReminderTimer = setInterval(runScanner, intervalMs);
  if (typeof pendingReminderTimer?.unref === 'function') {
    pendingReminderTimer.unref();
  }

  return pendingReminderTimer;
};

/**
 * Stops the automatic pending order reminder background scheduler if running.
 */
export const stopPendingOrderScheduler = () => {
  if (pendingReminderTimer) {
    clearInterval(pendingReminderTimer);
    pendingReminderTimer = null;
  }
};

