import mongoose from "mongoose";
import ReturnRequest from "../models/ReturnRequest.js";
import Refund from "../models/Refund.js";
import ReturnRefundPolicy from "../models/ReturnRefundPolicy.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import { logActivity, formatDhakaTime } from "../services/activityLogService.js";
import { createNotification } from "../services/notificationService.js";
import { sendEmail } from "../services/emailAdapter.js";

/**
 * Helper to check if a Mongoose model method is available and safely callable
 */
const isModelRunnable = (model, method) => {
    return Boolean(model && typeof model[method] === 'function');
};

/**
 * Generates an alphanumeric code with prefix
 */
const generateCode = (prefix, length = 6) => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${prefix}-${code}`;
};

// =============================================================================
// PUBLIC & POLICY ENDPOINTS
// =============================================================================

/**
 * Returns active Return & Refund Policy for customers and public visitors.
 * Route: GET /api/returns/policy
 * Public
 */
export const getPublicPolicy = async (req, res) => {
    try {
        let policy = null;
        if (isModelRunnable(ReturnRefundPolicy, 'findOne')) {
            policy = await ReturnRefundPolicy.findOne({ isPublished: true }).lean();
        }

        if (!policy && isModelRunnable(ReturnRefundPolicy, 'getOrInitializePolicy')) {
            const initialDoc = await ReturnRefundPolicy.getOrInitializePolicy();
            policy = initialDoc?.toObject ? initialDoc.toObject() : initialDoc;
        }

        // Fallback default if database model is offline or uninitialized
        if (!policy) {
            policy = {
                returnWindowDays: 7,
                eligibleReasons: [
                    "Damaged or defective item received",
                    "Wrong product delivered",
                    "Expired product received",
                    "Missing items from package",
                    "Quality not as described"
                ],
                nonReturnableCategories: [
                    "Fresh Vegetables",
                    "Fresh Fruits",
                    "Dairy & Chilled Items",
                    "Bakery & Bread"
                ],
                conditionRequirements: [
                    "Item must be unused and in original retail packaging",
                    "All product tags, seals, barcodes, and accessories must remain intact",
                    "Original GreenCart purchase invoice must be presented"
                ],
                shippingRules: "Free return pickup is arranged by GreenCart delivery agents within 24–48 hours of approval.",
                refundProcessingEstimate: "Refunds are processed within 3–5 business days following physical inspection.",
                policyContent: "GreenCart guarantees fresh, authentic groceries. Eligible delivered items may be returned within our return window.",
                cancellationRules: "Orders can be cancelled before packing or dispatch without penalty.",
                contactInfo: {
                    email: "support@greencart.com",
                    phone: "+880 1700-000000",
                    hours: "8:00 AM - 10:00 PM (Everyday)"
                },
                effectiveDate: new Date(),
                isPublished: true
            };
        }

        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        return res.json({
            success: true,
            policy: {
                ...policy,
                effectiveDateFormatted: formatDhakaTime(policy.effectiveDate)
            }
        });
    } catch (error) {
        console.error("Error in getPublicPolicy:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error fetching return policy" });
    }
};

/**
 * Admin view to inspect full return policy settings.
 * Route: GET /api/seller/returns/policy
 * Protected: Admin only
 */
export const getAdminPolicy = async (req, res) => {
    try {
        let policy = await ReturnRefundPolicy.findOne().lean();
        if (!policy) {
            const initialDoc = await ReturnRefundPolicy.getOrInitializePolicy();
            policy = initialDoc?.toObject ? initialDoc.toObject() : initialDoc;
        }

        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        return res.json({
            success: true,
            policy: {
                ...policy,
                effectiveDateFormatted: formatDhakaTime(policy.effectiveDate)
            }
        });
    } catch (error) {
        console.error("Error in getAdminPolicy:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error fetching policy settings" });
    }
};

/**
 * Admin update for Return & Refund Policy settings.
 * Route: PUT /api/seller/returns/policy
 * Protected: Admin only
 */
export const updateAdminPolicy = async (req, res) => {
    try {
        const {
            returnWindowDays,
            eligibleReasons,
            nonReturnableCategories,
            conditionRequirements,
            shippingRules,
            refundProcessingEstimate,
            policyContent,
            cancellationRules,
            contactInfo,
            isPublished
        } = req.body || {};

        if (returnWindowDays !== undefined) {
            if (typeof returnWindowDays !== 'number' || !Number.isInteger(returnWindowDays) || returnWindowDays < 1 || returnWindowDays > 90) {
                return res.status(400).json({ success: false, message: "Return window must be an integer between 1 and 90 days" });
            }
        }

        let policy = await ReturnRefundPolicy.findOne();
        if (!policy) {
            policy = new ReturnRefundPolicy();
        }

        const beforeState = policy.toObject ? policy.toObject() : { ...policy };

        if (returnWindowDays !== undefined) policy.returnWindowDays = returnWindowDays;
        if (Array.isArray(eligibleReasons)) policy.eligibleReasons = eligibleReasons.filter(Boolean);
        if (Array.isArray(nonReturnableCategories)) policy.nonReturnableCategories = nonReturnableCategories.filter(Boolean);
        if (Array.isArray(conditionRequirements)) policy.conditionRequirements = conditionRequirements.filter(Boolean);
        if (typeof shippingRules === 'string' && shippingRules.trim()) policy.shippingRules = shippingRules.trim();
        if (typeof refundProcessingEstimate === 'string' && refundProcessingEstimate.trim()) policy.refundProcessingEstimate = refundProcessingEstimate.trim();
        if (typeof policyContent === 'string' && policyContent.trim()) policy.policyContent = policyContent.trim();
        if (typeof cancellationRules === 'string' && cancellationRules.trim()) policy.cancellationRules = cancellationRules.trim();
        if (contactInfo && typeof contactInfo === 'object') {
            policy.contactInfo = {
                ...policy.contactInfo,
                ...contactInfo
            };
        }
        if (typeof isPublished === 'boolean') policy.isPublished = isPublished;

        policy.updatedBy = req.sellerEmail || "Admin";
        policy.lastReviewedBy = req.sellerEmail || "Admin";
        policy.effectiveDate = new Date();

        await policy.save();

        await logActivity({
            req,
            action: 'UPDATE',
            entityType: 'ORDER',
            entityId: String(policy._id || 'policy_singleton'),
            entityName: 'Return & Refund Policy Settings',
            description: `Admin updated Return & Refund Policy (Return Window: ${policy.returnWindowDays} days)`,
            before: { returnWindowDays: beforeState.returnWindowDays, isPublished: beforeState.isPublished },
            after: { returnWindowDays: policy.returnWindowDays, isPublished: policy.isPublished }
        });

        return res.json({
            success: true,
            message: "Return & Refund Policy updated successfully",
            policy
        });
    } catch (error) {
        console.error("Error in updateAdminPolicy:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error updating policy" });
    }
};

// =============================================================================
// CUSTOMER RETURN ENDPOINTS
// =============================================================================

/**
 * Customer submits a return request for eligible delivered order items.
 * Route: POST /api/returns/request
 * Protected: Customer (authUser)
 */
export const createReturnRequest = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const {
            orderId,
            items: requestedItems,
            customerNotes = "",
            images = [],
            returnMethod = "Pickup"
        } = req.body || {};

        // 1. Basic input validation
        if (!orderId || typeof orderId !== 'string') {
            return res.status(400).json({ success: false, message: "Valid Order ID is required" });
        }

        if (!Array.isArray(requestedItems) || requestedItems.length === 0) {
            return res.status(400).json({ success: false, message: "Please select at least one item to return" });
        }

        // 2. Load policy settings
        let policy = null;
        if (isModelRunnable(ReturnRefundPolicy, 'findOne')) {
            policy = await ReturnRefundPolicy.findOne({ isPublished: true }).lean();
        }
        const returnWindowDays = policy?.returnWindowDays || 7;
        const nonReturnableCategories = (policy?.nonReturnableCategories || []).map(c => c.toLowerCase());

        // 3. Load order and verify customer ownership
        let order = null;
        if (isModelRunnable(Order, 'findById')) {
            order = await Order.findById(orderId).populate('address items.product');
        } else if (isModelRunnable(Order, 'findOne')) {
            order = await Order.findOne({ _id: orderId });
        }

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (String(order.userId) !== String(userId)) {
            return res.status(403).json({ success: false, message: "You are not authorized to return items for this order" });
        }

        // 4. Order status must be 'Delivered'
        if (order.status !== 'Delivered') {
            return res.status(400).json({
                success: false,
                message: `Only delivered orders can be returned. Current order status: "${order.status}"`
            });
        }

        // 5. Enforce return window days
        const deliveryTimestamp = new Date(order.updatedAt || order.createdAt).getTime();
        const daysElapsed = (Date.now() - deliveryTimestamp) / (1000 * 60 * 60 * 24);
        if (daysElapsed > returnWindowDays) {
            return res.status(400).json({
                success: false,
                message: `The return window of ${returnWindowDays} days has expired for this order`
            });
        }

        // 6. Validate items against actual order records & prevent duplicates
        const sanitizedItems = [];
        let totalRefundAmount = 0;
        const requestedProductIds = [];

        for (const reqItem of requestedItems) {
            const { productId, quantity, reason } = reqItem || {};
            if (!productId || typeof productId !== 'string') {
                return res.status(400).json({ success: false, message: "Product ID is required for each return item" });
            }

            const numQty = Number(quantity);
            if (!Number.isInteger(numQty) || numQty < 1) {
                return res.status(400).json({ success: false, message: "Quantity must be a positive integer" });
            }

            if (!reason || typeof reason !== 'string' || !reason.trim()) {
                return res.status(400).json({ success: false, message: "A valid return reason is required for each item" });
            }

            // Find matching product in order
            const orderItem = (order.items || []).find(it => {
                const itProdId = it.product?._id ? String(it.product._id) : String(it.product);
                return itProdId === String(productId);
            });

            if (!orderItem) {
                return res.status(400).json({
                    success: false,
                    message: `Item with ID ${productId} was not found in this order`
                });
            }

            if (numQty > orderItem.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot return ${numQty} units of "${orderItem.name || 'product'}"; ordered quantity was ${orderItem.quantity}`
                });
            }

            // Category check for non-returnable items
            let categoryName = orderItem.product?.category || orderItem.category || "";
            if (!categoryName && isModelRunnable(Product, 'findById')) {
                try {
                    const prodDoc = await Product.findById(productId).select('category').lean();
                    if (prodDoc?.category) categoryName = prodDoc.category;
                } catch (_) {}
            }

            if (categoryName && nonReturnableCategories.includes(categoryName.toLowerCase())) {
                return res.status(400).json({
                    success: false,
                    message: `Category "${categoryName}" is non-returnable according to store policy`
                });
            }

            // Check if active return already exists for this order & product
            const existingActive = await ReturnRequest.findOne({
                orderId: String(order._id),
                "items.productId": String(productId),
                status: { $nin: ["Rejected", "Cancelled"] }
            });

            if (existingActive) {
                return res.status(400).json({
                    success: false,
                    message: `An active return request (${existingActive.returnNumber}) already exists for "${orderItem.name || 'this item'}"`
                });
            }

            const unitPrice = typeof orderItem.unitPrice === 'number' && orderItem.unitPrice >= 0
                ? orderItem.unitPrice
                : (orderItem.product?.price || 0);

            const itemTotal = unitPrice * numQty;
            totalRefundAmount += itemTotal;
            requestedProductIds.push(String(productId));

            sanitizedItems.push({
                productId: String(productId),
                name: orderItem.name || orderItem.product?.name || "Product Item",
                quantity: numQty,
                unitPrice,
                totalPrice: itemTotal,
                reason: reason.trim(),
                category: categoryName,
                image: (Array.isArray(orderItem.product?.image) ? orderItem.product.image[0] : orderItem.image) || ""
            });
        }

        // Cap refund amount at total order paid amount
        const maxOrderRefund = typeof order.amount === 'number' ? order.amount : totalRefundAmount;
        totalRefundAmount = Math.min(totalRefundAmount, maxOrderRefund);

        // 7. Format pickup address snapshot
        const addressObj = order.address || {};
        const pickupAddressSnapshot = {
            firstName: addressObj.firstName || "",
            lastName: addressObj.lastName || "",
            street: addressObj.street || "",
            city: addressObj.city || "",
            state: addressObj.state || "",
            zipCode: addressObj.zipCode || "",
            country: addressObj.country || "Bangladesh",
            phone: addressObj.phone || ""
        };

        // 8. Generate unique return number
        let returnNumber = generateCode("RET");
        if (isModelRunnable(ReturnRequest, 'findOne')) {
            let collision = await ReturnRequest.findOne({ returnNumber });
            while (collision) {
                returnNumber = generateCode("RET");
                collision = await ReturnRequest.findOne({ returnNumber });
            }
        }

        // 9. Create ReturnRequest record
        const initialHistory = [{
            status: "Pending",
            changedBy: "Customer",
            changedByRole: "Customer",
            note: customerNotes || "Return request submitted by customer",
            timestamp: new Date()
        }];

        const returnRequest = await ReturnRequest.create({
            returnNumber,
            userId: String(userId),
            orderId: String(order._id),
            orderNumber: order.orderNumber || String(order._id),
            orderDate: order.createdAt,
            items: sanitizedItems,
            customerNotes: typeof customerNotes === 'string' ? customerNotes.trim() : "",
            images: Array.isArray(images) ? images.filter(Boolean) : [],
            returnMethod: returnMethod === 'Drop-off' ? 'Drop-off' : 'Pickup',
            pickupAddress: pickupAddressSnapshot,
            status: "Pending",
            statusHistory: initialHistory,
            totalRefundAmount
        });

        // 10. Notify Admin/Staff of new return request
        await createNotification({
            sellerId: null,
            recipientRoles: ['Admin', 'CTO', 'CEO', 'Strategist'],
            type: 'order',
            title: `New Return Request: #${returnNumber}`,
            message: `Customer requested return for Order #${order.orderNumber || order._id} (৳${totalRefundAmount.toLocaleString()}).`,
            data: {
                orderId: String(order._id),
                orderNumber: order.orderNumber,
                customerId: String(userId),
                link: '/seller/returns'
            },
            dedupeKey: `return_request:${returnRequest._id}:submitted`
        });

        // 11. Activity Log
        await logActivity({
            req,
            action: 'CREATE',
            entityType: 'ORDER',
            entityId: String(order._id),
            entityName: `Order #${order.orderNumber || order._id}`,
            description: `Customer submitted Return Request #${returnNumber} for ৳${totalRefundAmount.toLocaleString()}`,
            after: { returnNumber, status: "Pending", itemsCount: sanitizedItems.length }
        });

        return res.status(201).json({
            success: true,
            message: "Return request submitted successfully. Our team will review it shortly.",
            returnRequest
        });

    } catch (error) {
        console.error("Error in createReturnRequest:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error creating return request" });
    }
};

/**
 * Returns list of return requests submitted by authenticated customer.
 * Route: GET /api/returns/my-returns
 * Protected: Customer (authUser)
 */
export const getMyReturns = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const returns = await ReturnRequest.find({ userId: String(userId) })
            .populate('refundId')
            .sort({ createdAt: -1 })
            .lean();

        const formatted = (returns || []).map(ret => ({
            ...ret,
            createdAtFormatted: formatDhakaTime(ret.createdAt),
            orderDateFormatted: formatDhakaTime(ret.orderDate)
        }));

        return res.json({
            success: true,
            returns: formatted
        });
    } catch (error) {
        console.error("Error in getMyReturns:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error fetching returns" });
    }
};

/**
 * Customer cancels their own pending return request.
 * Route: POST /api/returns/:returnId/cancel
 * Protected: Customer (authUser)
 */
export const cancelReturnRequest = async (req, res) => {
    try {
        const userId = req.userId;
        const { returnId } = req.params;

        if (!returnId || !mongoose.Types.ObjectId.isValid(returnId)) {
            return res.status(400).json({ success: false, message: "Invalid return ID" });
        }

        const returnDoc = await ReturnRequest.findById(returnId);
        if (!returnDoc) {
            return res.status(404).json({ success: false, message: "Return request not found" });
        }

        if (String(returnDoc.userId) !== String(userId)) {
            return res.status(403).json({ success: false, message: "You are not authorized to cancel this return request" });
        }

        if (returnDoc.status !== 'Pending') {
            return res.status(400).json({
                success: false,
                message: `Cannot cancel a return request that is already ${returnDoc.status}`
            });
        }

        returnDoc.status = 'Cancelled';
        returnDoc.statusHistory.push({
            status: 'Cancelled',
            changedBy: 'Customer',
            changedByRole: 'Customer',
            note: 'Return request cancelled by customer',
            timestamp: new Date()
        });

        await returnDoc.save();

        await logActivity({
            req,
            action: 'STATUS_CHANGE',
            entityType: 'ORDER',
            entityId: String(returnDoc.orderId),
            entityName: `Order #${returnDoc.orderNumber}`,
            description: `Customer cancelled Return Request #${returnDoc.returnNumber}`,
            before: { status: 'Pending' },
            after: { status: 'Cancelled' }
        });

        return res.json({
            success: true,
            message: "Return request cancelled successfully",
            returnRequest: returnDoc
        });
    } catch (error) {
        console.error("Error in cancelReturnRequest:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error cancelling return" });
    }
};

// =============================================================================
// ADMIN RETURN & REFUND MANAGEMENT ENDPOINTS
// =============================================================================

/**
 * Admin / Staff lists all return requests with filters and pagination.
 * Route: GET /api/seller/returns
 * Protected: Admin, CTO, CEO, Strategist
 */
export const getAllReturnRequests = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const skip = (page - 1) * limit;

        const { status, search } = req.query;
        const query = {};

        if (status && status !== 'ALL') {
            query.status = status;
        }

        if (search && typeof search === 'string' && search.trim()) {
            const cleanSearch = search.trim();
            query.$or = [
                { returnNumber: { $regex: cleanSearch, $options: 'i' } },
                { orderNumber: { $regex: cleanSearch, $options: 'i' } },
                { "items.name": { $regex: cleanSearch, $options: 'i' } }
            ];
        }

        const [totalCount, returns] = await Promise.all([
            ReturnRequest.countDocuments(query),
            ReturnRequest.find(query)
                .populate('refundId')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        const formatted = (returns || []).map(r => ({
            ...r,
            createdAtFormatted: formatDhakaTime(r.createdAt),
            orderDateFormatted: formatDhakaTime(r.orderDate)
        }));

        return res.json({
            success: true,
            returns: formatted,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages: Math.ceil(totalCount / limit) || 1
            }
        });
    } catch (error) {
        console.error("Error in getAllReturnRequests:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error fetching return requests" });
    }
};

/**
 * Admin Return & Refund Dashboard Statistics.
 * Route: GET /api/seller/returns/stats
 * Protected: Admin, CTO, CEO, Strategist
 */
export const getReturnStats = async (req, res) => {
    try {
        const [
            totalRequests,
            pendingRequests,
            approvedReturns,
            itemReceived,
            refundProcessing,
            completedRefunds,
            rejectedReturns,
            cancelledReturns,
            refundSumAggregate
        ] = await Promise.all([
            ReturnRequest.countDocuments(),
            ReturnRequest.countDocuments({ status: "Pending" }),
            ReturnRequest.countDocuments({ status: "Approved" }),
            ReturnRequest.countDocuments({ status: "Item Received" }),
            ReturnRequest.countDocuments({ status: "Refund Processing" }),
            ReturnRequest.countDocuments({ status: "Completed" }),
            ReturnRequest.countDocuments({ status: "Rejected" }),
            ReturnRequest.countDocuments({ status: "Cancelled" }),
            Refund.aggregate([
                { $match: { status: "Completed" } },
                { $group: { _id: null, totalAmount: { $sum: "$amount" } } }
            ])
        ]);

        const totalRefundedAmount = refundSumAggregate[0]?.totalAmount || 0;

        return res.json({
            success: true,
            stats: {
                totalRequests,
                pendingRequests,
                approvedReturns,
                itemReceived,
                refundProcessing,
                completedRefunds,
                rejectedReturns,
                cancelledReturns,
                totalRefundedAmount
            }
        });
    } catch (error) {
        console.error("Error in getReturnStats:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error calculating return stats" });
    }
};

/**
 * Returns single return request details by ID (Customer owner or Admin).
 * Route: GET /api/returns/:returnId
 */
export const getReturnById = async (req, res) => {
    try {
        const { returnId } = req.params;
        if (!returnId || !mongoose.Types.ObjectId.isValid(returnId)) {
            return res.status(400).json({ success: false, message: "Invalid return ID" });
        }

        const returnDoc = await ReturnRequest.findById(returnId).populate('refundId').lean();
        if (!returnDoc) {
            return res.status(404).json({ success: false, message: "Return request not found" });
        }

        // Authorization check: Must be owner customer OR authenticated staff
        const isStaff = Boolean(req.sellerId || req.sellerEmail || req.isTeamMember);
        if (!isStaff && String(returnDoc.userId) !== String(req.userId)) {
            return res.status(403).json({ success: false, message: "Access denied" });
        }

        return res.json({
            success: true,
            returnRequest: {
                ...returnDoc,
                createdAtFormatted: formatDhakaTime(returnDoc.createdAt),
                orderDateFormatted: formatDhakaTime(returnDoc.orderDate)
            }
        });
    } catch (error) {
        console.error("Error in getReturnById:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error fetching return request" });
    }
};

/**
 * Admin updates return request status (Approve, Reject, Item Received, etc.)
 * Restores product inventory exactly once if restockInventory is approved.
 * Route: PATCH /api/seller/returns/:returnId/status
 * Protected: Admin, CTO
 */
export const updateReturnStatus = async (req, res) => {
    try {
        const { returnId } = req.params;
        const { status, adminRemarks = "", rejectionReason = null, restockInventory = true } = req.body || {};

        if (!returnId || !mongoose.Types.ObjectId.isValid(returnId)) {
            return res.status(400).json({ success: false, message: "Invalid return ID" });
        }

        const ALLOWED_STATUSES = [
            "Pending",
            "Approved",
            "Rejected",
            "Item Received",
            "Refund Processing",
            "Completed",
            "Cancelled"
        ];

        if (!status || !ALLOWED_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}`
            });
        }

        const returnDoc = await ReturnRequest.findById(returnId);
        if (!returnDoc) {
            return res.status(404).json({ success: false, message: "Return request not found" });
        }

        // Terminal status check: Completed or Rejected cannot be reopened
        if (returnDoc.status === "Completed" && status !== "Completed") {
            return res.status(400).json({ success: false, message: "Cannot change status of a completed return" });
        }

        if (status === 'Rejected' && (!rejectionReason || typeof rejectionReason !== 'string' || !rejectionReason.trim())) {
            return res.status(400).json({ success: false, message: "A rejection reason is required when rejecting a return" });
        }

        const previousStatus = returnDoc.status;
        returnDoc.status = status;
        if (adminRemarks) returnDoc.adminRemarks = adminRemarks.trim();
        if (status === 'Rejected') returnDoc.rejectionReason = rejectionReason.trim();

        // Inventory Restoration exactly once upon 'Item Received' inspection
        let inventoryRestoredCount = 0;
        if ((status === 'Item Received' || status === 'Refund Processing' || status === 'Completed') && restockInventory && !returnDoc.stockRestored) {
            if (Array.isArray(returnDoc.items)) {
                for (const it of returnDoc.items) {
                    if (it.productId && typeof it.quantity === 'number' && it.quantity > 0) {
                        await Product.updateOne(
                            { _id: it.productId, stockQuantity: { $ne: null } },
                            {
                                $inc: { stockQuantity: it.quantity },
                                $set: { inStock: true }
                            }
                        );
                        inventoryRestoredCount += it.quantity;
                    }
                }
            }
            returnDoc.stockRestored = true;
        }

        const staffName = req.sellerEmail || "Admin Staff";
        const staffRole = req.sellerRole || "Admin";

        returnDoc.statusHistory.push({
            status,
            changedBy: staffName,
            changedByRole: staffRole,
            note: adminRemarks || rejectionReason || `Status updated to ${status}`,
            timestamp: new Date()
        });

        await returnDoc.save();

        // Customer Notification (Deduplicated via unique dedupeKey)
        const dedupeKey = `return_status:${returnDoc._id}:${status}`;
        await createNotification({
            sellerId: null,
            recipientRoles: ['Admin', 'CTO', 'CEO', 'Strategist'],
            type: 'order',
            title: `Return Status Update: #${returnDoc.returnNumber}`,
            message: `Return #${returnDoc.returnNumber} status moved to ${status}.`,
            data: {
                orderId: returnDoc.orderId,
                orderNumber: returnDoc.orderNumber,
                customerId: returnDoc.userId,
                link: '/seller/returns'
            },
            dedupeKey
        });

        // Optional Customer Email Notification (Non-blocking)
        try {
            const customer = await User.findById(returnDoc.userId).select('email name').lean();
            if (customer?.email) {
                const subject = `GreenCart Return Update — ${returnDoc.returnNumber} is now ${status}`;
                const textContent = `Dear ${customer.name || 'Customer'},\n\nYour return request #${returnDoc.returnNumber} for Order #${returnDoc.orderNumber} has been updated to "${status}".\n\nNotes: ${adminRemarks || rejectionReason || 'Thank you for shopping with GreenCart.'}\n\nBest regards,\nGreenCart Support Team`;
                await sendEmail({
                    toEmail: customer.email,
                    subject,
                    textContent,
                    htmlContent: `<p>${textContent.replace(/\n/g, '<br/>')}</p>`
                });
            }
        } catch (_) {}

        // Log Activity
        await logActivity({
            req,
            action: 'STATUS_CHANGE',
            entityType: 'ORDER',
            entityId: String(returnDoc.orderId),
            entityName: `Order #${returnDoc.orderNumber}`,
            description: `Admin updated Return #${returnDoc.returnNumber} status from "${previousStatus}" to "${status}"${inventoryRestoredCount > 0 ? ` (Restocked ${inventoryRestoredCount} items)` : ''}`,
            before: { status: previousStatus },
            after: { status, stockRestored: returnDoc.stockRestored }
        });

        return res.json({
            success: true,
            message: `Return request status updated to ${status}`,
            returnRequest: returnDoc
        });
    } catch (error) {
        console.error("Error in updateReturnStatus:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error updating return status" });
    }
};

/**
 * Admin processes and completes refund for an approved/received return.
 * Route: POST /api/seller/returns/:returnId/refund
 * Protected: Admin only
 */
export const processRefund = async (req, res) => {
    try {
        const { returnId } = req.params;
        const {
            amount,
            refundMethod = "Original Payment",
            transactionReference = null,
            notes = ""
        } = req.body || {};

        if (!returnId || !mongoose.Types.ObjectId.isValid(returnId)) {
            return res.status(400).json({ success: false, message: "Invalid return ID" });
        }

        const returnDoc = await ReturnRequest.findById(returnId);
        if (!returnDoc) {
            return res.status(404).json({ success: false, message: "Return request not found" });
        }

        // Validate state for refund
        if (!['Approved', 'Item Received', 'Refund Processing'].includes(returnDoc.status)) {
            return res.status(400).json({
                success: false,
                message: `Refund cannot be processed for return in "${returnDoc.status}" status. Return must be Approved or Item Received.`
            });
        }

        // Prevent duplicate refund
        const existingCompletedRefund = await Refund.findOne({
            returnRequestId: returnDoc._id,
            status: "Completed"
        });
        if (existingCompletedRefund) {
            return res.status(400).json({
                success: false,
                message: `A completed refund (${existingCompletedRefund.refundNumber}) already exists for this return request`
            });
        }

        // Validate refund amount
        const refundAmount = Number(amount !== undefined ? amount : returnDoc.totalRefundAmount);
        if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
            return res.status(400).json({ success: false, message: "Refund amount must be greater than 0" });
        }

        if (refundAmount > returnDoc.totalRefundAmount) {
            return res.status(400).json({
                success: false,
                message: `Refund amount (৳${refundAmount}) cannot exceed return item value of ৳${returnDoc.totalRefundAmount}`
            });
        }

        // Generate unique refund number
        let refundNumber = generateCode("REF");
        let collision = await Refund.findOne({ refundNumber });
        while (collision) {
            refundNumber = generateCode("REF");
            collision = await Refund.findOne({ refundNumber });
        }

        const staffName = req.sellerEmail || "Admin Staff";
        const staffRole = req.sellerRole || "Admin";

        // Create Refund record
        const refund = await Refund.create({
            refundNumber,
            returnRequestId: returnDoc._id,
            orderId: returnDoc.orderId,
            orderNumber: returnDoc.orderNumber,
            userId: returnDoc.userId,
            amount: refundAmount,
            refundMethod,
            status: "Completed",
            transactionReference: transactionReference ? String(transactionReference).trim() : null,
            processedBy: staffName,
            processedByRole: staffRole,
            processedAt: new Date(),
            notes: notes ? String(notes).trim() : "",
            history: [{
                status: "Completed",
                changedBy: staffName,
                note: notes || `Refund of ৳${refundAmount} processed via ${refundMethod}`,
                timestamp: new Date()
            }]
        });

        // Update ReturnRequest to 'Completed' and link refundId
        returnDoc.status = "Completed";
        returnDoc.refundId = refund._id;
        returnDoc.statusHistory.push({
            status: "Completed",
            changedBy: staffName,
            changedByRole: staffRole,
            note: `Refund #${refundNumber} of ৳${refundAmount} successfully processed via ${refundMethod}`,
            timestamp: new Date()
        });
        await returnDoc.save();

        // Customer and Staff Notification
        const dedupeKey = `refund_completed:${refund._id}`;
        await createNotification({
            sellerId: null,
            recipientRoles: ['Admin', 'CTO', 'CEO', 'Strategist'],
            type: 'order',
            title: `Refund Completed: #${refundNumber}`,
            message: `Refund of ৳${refundAmount.toLocaleString()} completed for Return #${returnDoc.returnNumber} (Order #${returnDoc.orderNumber}).`,
            data: {
                orderId: returnDoc.orderId,
                orderNumber: returnDoc.orderNumber,
                customerId: returnDoc.userId,
                amount: refundAmount,
                link: '/seller/returns'
            },
            dedupeKey
        });

        // Notify customer via email
        try {
            const customer = await User.findById(returnDoc.userId).select('email name').lean();
            if (customer?.email) {
                const subject = `GreenCart Refund Confirmation — ৳${refundAmount} for Order #${returnDoc.orderNumber}`;
                const textContent = `Dear ${customer.name || 'Customer'},\n\nWe have successfully processed your refund of ৳${refundAmount} for Return #${returnDoc.returnNumber}.\n\nRefund Reference: ${refundNumber}\nPayment Method: ${refundMethod}\n\nThank you for choosing GreenCart.\n\nBest regards,\nGreenCart Finance Team`;
                await sendEmail({
                    toEmail: customer.email,
                    subject,
                    textContent,
                    htmlContent: `<p>${textContent.replace(/\n/g, '<br/>')}</p>`
                });
            }
        } catch (_) {}

        // Log Activity
        await logActivity({
            req,
            action: 'UPDATE',
            entityType: 'ORDER',
            entityId: String(returnDoc.orderId),
            entityName: `Order #${returnDoc.orderNumber}`,
            description: `Admin processed Refund #${refundNumber} of ৳${refundAmount.toLocaleString()} via ${refundMethod}`,
            after: { refundNumber, refundAmount, returnStatus: "Completed" }
        });

        return res.json({
            success: true,
            message: `Refund of ৳${refundAmount} processed successfully`,
            refund,
            returnRequest: returnDoc
        });
    } catch (error) {
        console.error("Error in processRefund:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error processing refund" });
    }
};
