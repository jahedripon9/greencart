import mongoose from "mongoose";
import Contact from "../models/Contact.js";
import User from "../models/User.js";
import Order from "../models/Order.js";
import Address from "../models/Address.js";
import Product from "../models/Product.js";
import Conversation from "../models/Conversation.js";
import { normalizeTeamImageUrl, isValidTeamImage } from "./teamController.js";
import { notifyNewCustomer } from "../services/notificationService.js";
import { logActivity } from "../services/activityLogService.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{5,20}$/;
const VALID_STATUSES = ['Active', 'Lead', 'Customer', 'Inactive'];

export const escapeRegex = (string) => {
    return typeof string === 'string'
        ? string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        : '';
};

/**
 * Checks if a Mongoose model method is runnable without buffering timeouts.
 * Always true when database is connected (readyState === 1);
 * in disconnected / test environment, true only if explicitly mocked.
 */
export const isModelRunnable = (model, method = 'find') => {
    if (!model || typeof model[method] !== 'function') return false;
    if (mongoose.connection && mongoose.connection.readyState === 1) return true;
    return model[method] !== mongoose.Model[method];
};

/**
 * Returns the effective seller account identifier for data isolation.
 * Store team members and root merchant share the store contact pool,
 * while independent/tenant sellers are strictly isolated.
 */
export const getEffectiveSellerId = (req) => {
    if (!req) return 'unknown_seller';
    const rootAdminEmail = process.env.SELLER_EMAIL?.toLowerCase();
    const reqEmail = req.sellerEmail?.toLowerCase();

    if (req.isTeamMember || (rootAdminEmail && reqEmail === rootAdminEmail)) {
        return rootAdminEmail || 'store_root';
    }
    return String(req.sellerId || reqEmail || 'unknown_seller');
};

/**
 * Builds the MongoDB query condition to find all qualifying orders belonging to the seller.
 */
export const getSellerOrderQuery = async (req) => {
    const sellerId = getEffectiveSellerId(req);
    const rootAdminEmail = process.env.SELLER_EMAIL?.toLowerCase();
    const reqEmail = req?.sellerEmail?.toLowerCase();
    const isStore = Boolean(
        req?.isTeamMember ||
        (rootAdminEmail && reqEmail === rootAdminEmail) ||
        sellerId === rootAdminEmail ||
        sellerId === 'store_root'
    );

    if (isStore) {
        return {
            $or: [{ paymentType: "COD" }, { isPaid: true }]
        };
    }

    // Tenant / multi-seller isolation
    let productIds = [];
    if (isModelRunnable(Product, 'find')) {
        try {
            const sellerProducts = await Product.find({ sellerId: req.sellerId || sellerId }).select('_id').lean();
            productIds = (sellerProducts || []).map(p => String(p._id));
        } catch (_) {
            productIds = [];
        }
    }

    const sellerMatchClauses = [
        { sellerId: req.sellerId || sellerId }
    ];
    if (productIds.length > 0) {
        sellerMatchClauses.push({ 'items.product': { $in: productIds } });
    }

    return {
        $and: [
            { $or: [{ paymentType: "COD" }, { isPaid: true }] },
            { $or: sellerMatchClauses }
        ]
    };
};

/**
 * Automatically synchronizes a newly placed order to the seller's contact directory.
 * Ensures repeated orders increment order count and do not create duplicate contact entries.
 */
export const syncCustomerContactFromOrder = async (order, addressDoc) => {
    if (!order || !order.userId) return;
    if (!isModelRunnable(Contact, 'findOne')) return;

    try {
        const rootAdminEmail = process.env.SELLER_EMAIL?.toLowerCase() || 'store_root';
        const sellers = new Set();

        const productIds = (order.items || []).map(it => it.product?._id || it.product).filter(Boolean);
        if (productIds.length > 0 && isModelRunnable(Product, 'find')) {
            try {
                const products = await Product.find({ _id: { $in: productIds } }).select('sellerId').lean();
                for (const prod of (products || [])) {
                    if (prod.sellerId && prod.sellerId !== rootAdminEmail) {
                        sellers.add(prod.sellerId);
                    } else {
                        sellers.add(rootAdminEmail);
                    }
                }
            } catch (_) {}
        }

        if (sellers.size === 0) {
            sellers.add(rootAdminEmail);
        }

        let user = null;
        if (isModelRunnable(User, 'findById')) {
            try {
                user = await User.findById(order.userId).select('name email').lean();
            } catch (_) {}
        }
        if (!user && isModelRunnable(User, 'findOne')) {
            try {
                user = await User.findOne({ _id: order.userId }).select('name email').lean();
            } catch (_) {}
        }

        let address = addressDoc;
        if (!address && order.address && isModelRunnable(Address, 'findById')) {
            try {
                address = await Address.findById(order.address).lean();
            } catch (_) {}
        }

        const customerEmail = (user?.email || address?.email || '').trim().toLowerCase();
        if (!customerEmail) return;

        const customerName = (
            user?.name ||
            (address ? `${address.firstName || ''} ${address.lastName || ''}`.trim() : '') ||
            'Customer'
        ).trim();

        const customerPhone = (address?.phone || '').trim();

        for (const sellerId of sellers) {
            const existingContact = await Contact.findOne({
                sellerId,
                $or: [
                    { userId: String(order.userId) },
                    { email: customerEmail }
                ]
            });

            if (existingContact) {
                existingContact.totalOrders = (existingContact.totalOrders || 0) + 1;
                existingContact.latestOrderDate = order.createdAt || new Date();
                existingContact.status = 'Customer';
                if (!existingContact.userId) {
                    existingContact.userId = String(order.userId);
                }
                if (!existingContact.phone && customerPhone) {
                    existingContact.phone = customerPhone;
                }
                if (typeof existingContact.save === 'function') {
                    await existingContact.save();
                }
            } else {
                const newContact = new Contact({
                    sellerId,
                    userId: String(order.userId),
                    name: customerName,
                    email: customerEmail,
                    phone: customerPhone || '',
                    status: 'Customer',
                    totalOrders: 1,
                    latestOrderDate: order.createdAt || new Date()
                });
                if (typeof newContact.save === 'function') {
                    await newContact.save();
                }

                // Smart Notification Center: New Customer Alert
                try {
                    await notifyNewCustomer({ customer: newContact, order, sellerId });
                } catch (notifErr) {
                    console.error("New customer notification error:", notifErr.message);
                }
            }
        }
    } catch (err) {
        console.error("syncCustomerContactFromOrder error:", err.message);
    }
};

/**
 * Scans existing order records and automatically syncs all historical customers
 * who have placed orders for this seller into the Contact directory.
 */
export const syncExistingCustomersFromOrders = async (sellerId, req) => {
    if (!isModelRunnable(Order, 'find')) return;

    try {
        const orderQuery = await getSellerOrderQuery(req);

        let query = Order.find(orderQuery);
        if (typeof query?.populate === 'function') {
            query = query.populate('address');
        }
        if (typeof query?.sort === 'function') {
            query = query.sort({ createdAt: -1 });
        }

        let orders;
        if (typeof query?.lean === 'function') {
            orders = await query.lean();
        } else {
            orders = await query;
        }

        if (!Array.isArray(orders) || orders.length === 0) return;

        // Group orders by customer (userId preferred, fallback to address email)
        const customerOrdersMap = new Map();
        for (const order of orders) {
            if (!order) continue;
            const customerKey = String(order.userId || order.address?.email || order._id);
            if (!customerOrdersMap.has(customerKey)) {
                customerOrdersMap.set(customerKey, {
                    userId: order.userId ? String(order.userId) : null,
                    orders: [order],
                    latestOrder: order,
                    latestAddress: order.address
                });
            } else {
                const entry = customerOrdersMap.get(customerKey);
                entry.orders.push(order);
                const orderTime = new Date(order.createdAt || 0).getTime();
                const latestTime = new Date(entry.latestOrder?.createdAt || 0).getTime();
                if (orderTime > latestTime) {
                    entry.latestOrder = order;
                    if (order.address) {
                        entry.latestAddress = order.address;
                    }
                }
            }
        }

        for (const [key, data] of customerOrdersMap.entries()) {
            const customerUserId = data.userId;
            const latestOrder = data.latestOrder;
            const address = data.latestAddress;

            // Fetch User if available
            let user = null;
            if (customerUserId && isModelRunnable(User, 'findById')) {
                try {
                    user = await User.findById(customerUserId).select('_id name email').lean();
                } catch (_) {}
            }
            if (!user && customerUserId && isModelRunnable(User, 'findOne')) {
                try {
                    user = await User.findOne({ _id: customerUserId }).select('_id name email').lean();
                } catch (_) {}
            }

            const email = (user?.email || address?.email || '').trim().toLowerCase();
            if (!email) continue;

            const name = (
                user?.name ||
                (address ? `${address.firstName || ''} ${address.lastName || ''}`.trim() : '') ||
                'Customer'
            ).trim();

            const phone = (address?.phone || '').trim();
            const totalOrders = data.orders.length;
            const latestOrderDate = latestOrder.createdAt || new Date();

            // Check if contact already exists
            const existingContact = await Contact.findOne({
                sellerId,
                $or: [
                    ...(customerUserId ? [{ userId: customerUserId }] : []),
                    { email }
                ]
            });

            if (existingContact) {
                let changed = false;
                if (!existingContact.userId && customerUserId) {
                    existingContact.userId = customerUserId;
                    changed = true;
                }
                if ((existingContact.totalOrders || 0) < totalOrders) {
                    existingContact.totalOrders = totalOrders;
                    changed = true;
                }
                if (latestOrderDate && (!existingContact.latestOrderDate || new Date(latestOrderDate) > new Date(existingContact.latestOrderDate))) {
                    existingContact.latestOrderDate = latestOrderDate;
                    changed = true;
                }
                if (!existingContact.phone && phone) {
                    existingContact.phone = phone;
                    changed = true;
                }
                if (existingContact.status === 'Lead') {
                    existingContact.status = 'Customer';
                    changed = true;
                }
                if (changed && typeof existingContact.save === 'function') {
                    await existingContact.save();
                }
            } else {
                const newContact = new Contact({
                    sellerId,
                    userId: customerUserId,
                    name,
                    email,
                    phone: phone || '',
                    status: 'Customer',
                    totalOrders,
                    latestOrderDate
                });
                if (typeof newContact.save === 'function') {
                    await newContact.save();
                }

                // Smart Notification Center: New Customer Alert
                try {
                    await notifyNewCustomer({ customer: newContact, order: null, sellerId });
                } catch (notifErr) {
                    console.error("New customer notification error:", notifErr.message);
                }
            }
        }
    } catch (err) {
        console.error("syncExistingCustomersFromOrders error:", err.message);
    }
};

/**
 * Get contacts / customer directory for the authenticated seller.
 * Automatically synchronizes customers from existing order records so that all customers
 * who have placed orders automatically appear.
 * GET /api/seller/contacts?search=query
 */
export const getContacts = async (req, res) => {
    try {
        const sellerId = getEffectiveSellerId(req);

        // Automatically sync customers from existing order records
        await syncExistingCustomersFromOrders(sellerId, req);

        const { search } = req.query;
        const query = { sellerId };

        if (search && typeof search === 'string' && search.trim()) {
            const escaped = escapeRegex(search.trim());
            query.$or = [
                { name: { $regex: escaped, $options: 'i' } },
                { email: { $regex: escaped, $options: 'i' } },
                { phone: { $regex: escaped, $options: 'i' } }
            ];
        }

        const contacts = await Contact.find(query)
            .sort({ latestOrderDate: -1, createdAt: -1 })
            .lean();

        const formatted = contacts.map(c => {
            const raw = typeof c.toObject === 'function' ? c.toObject() : (c._doc || c);
            return {
                ...raw,
                image: raw.image ? normalizeTeamImageUrl(raw.image) : ''
            };
        });

        return res.json({ success: true, contacts: formatted });
    } catch (error) {
        console.error("Get contacts error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Get a single contact by ID along with matched genuine order history.
 * GET /api/seller/contacts/:id
 */
export const getContactById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid contact ID format" });
        }

        const sellerId = getEffectiveSellerId(req);
        const contact = await Contact.findOne({ _id: id, sellerId }).lean();
        if (!contact) {
            return res.status(404).json({ success: false, message: "Contact not found" });
        }

        if (contact.image) {
            contact.image = normalizeTeamImageUrl(contact.image);
        }

        // Match existing customer account without fabricating data
        let customer = null;
        if (contact.userId && typeof User?.findById === 'function') {
            try {
                customer = await User.findById(contact.userId)
                    .select('_id name email clerkId authProvider')
                    .lean();
            } catch (_) {}
        }
        if (!customer && typeof User?.findOne === 'function') {
            try {
                customer = await User.findOne({ email: contact.email.toLowerCase() })
                    .select('_id name email clerkId authProvider')
                    .lean();
            } catch (_) {}
        }

        let orders = [];
        const customerLookupId = customer ? String(customer._id) : (contact.userId || null);

        if (customerLookupId && isModelRunnable(Order, 'find')) {
            const sellerOrderQuery = await getSellerOrderQuery(req);
            const orderFilter = {
                userId: customerLookupId,
                ...sellerOrderQuery
            };

            let ordQuery = Order.find(orderFilter);
            if (typeof ordQuery?.populate === 'function') {
                ordQuery = ordQuery.populate([
                    { path: 'items.product', select: 'name price offerPrice image' },
                    { path: 'address' }
                ]);
            }
            if (typeof ordQuery?.sort === 'function') {
                ordQuery = ordQuery.sort({ createdAt: -1 });
            }
            if (typeof ordQuery?.limit === 'function') {
                ordQuery = ordQuery.limit(50);
            }
            if (typeof ordQuery?.lean === 'function') {
                orders = await ordQuery.lean();
            } else {
                orders = await ordQuery;
            }
        }

        return res.json({
            success: true,
            contact: {
                ...contact,
                totalOrders: Array.isArray(orders) && orders.length > 0 ? orders.length : (contact.totalOrders || 0),
                latestOrderDate: Array.isArray(orders) && orders.length > 0 ? orders[0].createdAt : contact.latestOrderDate
            },
            customer: customer || null,
            orders: Array.isArray(orders) ? orders : []
        });
    } catch (error) {
        console.error("Get contact by id error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Add a contact (preserved for backward compatibility and manual lead addition)
 * POST /api/seller/contacts
 */
export const addContact = async (req, res) => {
    try {
        const sellerId = getEffectiveSellerId(req);
        const { name, email, phone = '', image = '', notes = '', status = 'Customer', userId = null } = req.body || {};

        // 1. Validations
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ success: false, message: "Full Name is required" });
        }
        if (name.trim().length < 2 || name.trim().length > 100) {
            return res.status(400).json({ success: false, message: "Name must be between 2 and 100 characters" });
        }

        if (!email || typeof email !== 'string' || !email.trim()) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }
        const trimmedEmail = email.trim().toLowerCase();
        if (!EMAIL_REGEX.test(trimmedEmail)) {
            return res.status(400).json({ success: false, message: "Please provide a valid email address" });
        }

        if (phone && typeof phone === 'string' && phone.trim()) {
            if (!PHONE_REGEX.test(phone.trim())) {
                return res.status(400).json({ success: false, message: "Please provide a valid phone number" });
            }
        } else if (!phone || !String(phone).trim()) {
            return res.status(400).json({ success: false, message: "Phone number is required" });
        }

        // 2. Profile image URL normalization & validation
        let normalizedImage = '';
        if (image !== undefined && image !== null && image !== '') {
            normalizedImage = normalizeTeamImageUrl(image);
            if (!isValidTeamImage(normalizedImage)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid profile image. Must be a valid HTTP(S) URL or safe image data URI (PNG, JPEG, WebP only, max 2048 characters)."
                });
            }
        }

        const validStatus = VALID_STATUSES.includes(status) ? status : 'Customer';

        // 3. Prevent duplicate contacts based on email within the same seller account
        const existing = await Contact.findOne({ sellerId, email: trimmedEmail });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: "A contact with this email address already exists in your contacts list"
            });
        }

        // 4. Create and persist
        const newContact = new Contact({
            sellerId,
            userId: userId ? String(userId) : null,
            name: name.trim(),
            email: trimmedEmail,
            phone: typeof phone === 'string' ? phone.trim() : '',
            image: typeof normalizedImage === 'string' ? normalizedImage.trim() : '',
            notes: typeof notes === 'string' ? notes.trim() : '',
            status: validStatus,
            totalOrders: 1,
            latestOrderDate: new Date()
        });

        await newContact.save();

        await logActivity({
            req,
            action: 'CREATE',
            entityType: 'CUSTOMER',
            entityId: newContact._id,
            entityName: newContact.name,
            description: `Added customer "${newContact.name}"`,
            after: {
                name: newContact.name,
                email: newContact.email,
                phone: newContact.phone,
                status: newContact.status
            }
        });

        return res.status(201).json({
            success: true,
            message: "Contact added successfully",
            contact: newContact
        });
    } catch (error) {
        console.error("Add contact error:", error.message);
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: "A contact with this email address already exists in your contacts list"
            });
        }
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Update an existing contact
 * PUT /api/seller/contacts/:id
 */
export const updateContact = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid contact ID format" });
        }

        const sellerId = getEffectiveSellerId(req);
        const contact = await Contact.findOne({ _id: id, sellerId });
        if (!contact) {
            return res.status(404).json({ success: false, message: "Contact not found" });
        }

        const beforeContact = {
            name: contact.name,
            email: contact.email,
            phone: contact.phone,
            image: contact.image,
            notes: contact.notes,
            status: contact.status
        };

        const { name, email, phone, image, notes, status } = req.body || {};

        if (name !== undefined) {
            if (typeof name !== 'string' || !name.trim()) {
                return res.status(400).json({ success: false, message: "Full Name cannot be empty" });
            }
            if (name.trim().length < 2 || name.trim().length > 100) {
                return res.status(400).json({ success: false, message: "Name must be between 2 and 100 characters" });
            }
            contact.name = name.trim();
        }

        if (email !== undefined) {
            const trimmedEmail = String(email).trim().toLowerCase();
            if (!EMAIL_REGEX.test(trimmedEmail)) {
                return res.status(400).json({ success: false, message: "Please provide a valid email address" });
            }

            if (trimmedEmail !== contact.email) {
                const existing = await Contact.findOne({ sellerId, email: trimmedEmail, _id: { $ne: id } });
                if (existing) {
                    return res.status(400).json({
                        success: false,
                        message: "A contact with this email address already exists in your contacts list"
                    });
                }
                contact.email = trimmedEmail;
            }
        }

        if (phone !== undefined) {
            const trimmedPhone = String(phone).trim();
            if (trimmedPhone && !PHONE_REGEX.test(trimmedPhone)) {
                return res.status(400).json({ success: false, message: "Please provide a valid phone number" });
            }
            contact.phone = trimmedPhone;
        }

        if (image !== undefined) {
            if (image !== '' && image !== null) {
                const normalizedImage = normalizeTeamImageUrl(image);
                if (!isValidTeamImage(normalizedImage)) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid profile image. Must be a valid HTTP(S) URL or safe image data URI (PNG, JPEG, WebP only, max 2048 characters)."
                    });
                }
                contact.image = typeof normalizedImage === 'string' ? normalizedImage.trim() : '';
            } else {
                contact.image = '';
            }
        }

        if (notes !== undefined) {
            contact.notes = typeof notes === 'string' ? notes.trim() : '';
        }

        if (status !== undefined) {
            if (!VALID_STATUSES.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: `Status must be one of: ${VALID_STATUSES.join(', ')}`
                });
            }
            contact.status = status;
        }

        await contact.save();

        await logActivity({
            req,
            action: 'UPDATE',
            entityType: 'CUSTOMER',
            entityId: contact._id,
            entityName: contact.name || contact.email,
            description: `Updated customer "${contact.name}"`,
            before: beforeContact,
            after: {
                name: contact.name,
                email: contact.email,
                phone: contact.phone,
                image: contact.image,
                notes: contact.notes,
                status: contact.status
            }
        });

        return res.json({
            success: true,
            message: "Contact updated successfully",
            contact
        });
    } catch (error) {
        console.error("Update contact error:", error.message);
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: "A contact with this email address already exists in your contacts list"
            });
        }
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Delete a contact
 * DELETE /api/seller/contacts/:id
 */
export const deleteContact = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid contact ID format" });
        }

        const sellerId = getEffectiveSellerId(req);
        const deleted = await Contact.findOneAndDelete({ _id: id, sellerId });
        if (!deleted) {
            return res.status(404).json({ success: false, message: "Contact not found" });
        }

        await logActivity({
            req,
            action: 'DELETE',
            entityType: 'CUSTOMER',
            entityId: deleted._id,
            entityName: deleted.name || deleted.email,
            description: `Deleted customer "${deleted.name}"`,
            before: {
                name: deleted.name,
                email: deleted.email,
                status: deleted.status
            }
        });

        return res.json({
            success: true,
            message: "Contact deleted successfully"
        });
    } catch (error) {
        console.error("Delete contact error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Initiate or locate existing chat conversation for a contact
 * POST /api/seller/contacts/:id/chat
 */
export const initiateContactChat = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid contact ID format" });
        }

        const sellerId = getEffectiveSellerId(req);
        const contact = await Contact.findOne({ _id: id, sellerId });
        if (!contact) {
            return res.status(404).json({ success: false, message: "Contact not found" });
        }

        // Locate matching registered customer account
        let customer = null;
        if (contact.userId && typeof User?.findById === 'function') {
            try {
                customer = await User.findById(contact.userId);
            } catch (_) {}
        }
        if (!customer && typeof User?.findOne === 'function') {
            try {
                customer = await User.findOne({ email: contact.email.toLowerCase() });
            } catch (_) {}
        }

        if (!customer) {
            return res.status(200).json({
                success: false,
                isRegisteredCustomer: false,
                message: "This contact does not have a GreenCart customer account yet. You can communicate via email or phone."
            });
        }

        // Find existing conversation with this customer or create one
        let conversation = await Conversation.findOne({ customerId: customer._id });
        if (!conversation) {
            conversation = new Conversation({
                customerId: customer._id,
                lastMessage: "Conversation initiated with contact",
                lastMessageAt: new Date()
            });
            await conversation.save();
        }

        return res.json({
            success: true,
            isRegisteredCustomer: true,
            conversationId: conversation._id
        });
    } catch (error) {
        console.error("Initiate contact chat error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
