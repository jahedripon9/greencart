import mongoose from "mongoose";
import StoreContent from "../models/StoreContent.js";
import { logActivity } from "../services/activityLogService.js";

/**
 * Helper to check if model method is safe to run without timeout
 */
const isModelRunnable = (model, method = 'findOne') => {
    return Boolean(
        mongoose.connection.readyState === 1 &&
        model &&
        typeof model[method] === 'function'
    );
};

// =============================================================================
// PUBLIC ENDPOINTS
// =============================================================================

/**
 * Returns public-facing store content, published payment methods, and published FAQs.
 * Route: GET /api/store-content/public
 * Access: Public
 */
export const getPublicStoreContent = async (req, res) => {
    try {
        let content = null;
        if (isModelRunnable(StoreContent, 'findOne')) {
            content = await StoreContent.findOne().lean();
        }

        if (!content && isModelRunnable(StoreContent, 'getOrInitializeStoreContent')) {
            const initialDoc = await StoreContent.getOrInitializeStoreContent();
            content = initialDoc?.toObject ? initialDoc.toObject() : initialDoc;
        }

        if (!content) {
            content = new StoreContent().toObject();
        }

        // Filter only active payment methods and published FAQs for customers
        const publicPaymentMethods = (content.paymentMethods || [])
            .filter(p => p.isActive !== false)
            .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

        const publicFaqs = (content.faqs || [])
            .filter(f => f.isPublished !== false)
            .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

        // Set cache control headers to prevent stale browser caches
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        // Distinct published FAQ categories
        const faqCategories = Array.from(new Set(publicFaqs.map(f => f.category || "General"))).filter(Boolean);

        const payload = {
            support: content.support,
            delivery: content.delivery,
            paymentMethods: publicPaymentMethods,
            bestSellers: content.bestSellers,
            offersDeals: content.offersDeals,
            contact: content.contact,
            faqs: publicFaqs,
            faqCategories
        };

        return res.json({
            success: true,
            content: payload,
            data: payload
        });
    } catch (error) {
        console.error("Error in getPublicStoreContent:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error fetching store content" });
    }
};

/**
 * Returns published FAQs with optional category filtering.
 * Route: GET /api/store-content/faqs
 * Access: Public
 */
export const getPublicFAQs = async (req, res) => {
    try {
        let content = null;
        if (isModelRunnable(StoreContent, 'findOne')) {
            content = await StoreContent.findOne().lean();
        }

        if (!content && isModelRunnable(StoreContent, 'getOrInitializeStoreContent')) {
            const initialDoc = await StoreContent.getOrInitializeStoreContent();
            content = initialDoc?.toObject ? initialDoc.toObject() : initialDoc;
        }

        if (!content) {
            content = new StoreContent().toObject();
        }

        let faqs = (content.faqs || [])
            .filter(f => f.isPublished !== false)
            .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

        const categories = Array.from(new Set(faqs.map(f => f.category || "General"))).filter(Boolean);

        const categoryFilter = req.query.category?.trim();
        if (categoryFilter && categoryFilter.toLowerCase() !== 'all') {
            faqs = faqs.filter(f => (f.category || "").toLowerCase() === categoryFilter.toLowerCase());
        }

        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        return res.json({
            success: true,
            faqs,
            categories
        });
    } catch (error) {
        console.error("Error in getPublicFAQs:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error fetching FAQs" });
    }
};

// =============================================================================
// ADMIN MANAGEMENT ENDPOINTS
// =============================================================================

/**
 * Returns full store content for Admin inspection.
 * Route: GET /api/store-content/admin
 * Access: Protected (Admin only)
 */
export const getAdminStoreContent = async (req, res) => {
    try {
        let content = await StoreContent.findOne();
        if (!content) {
            content = await StoreContent.getOrInitializeStoreContent();
        }

        return res.json({
            success: true,
            content,
            data: content
        });
    } catch (error) {
        console.error("Error in getAdminStoreContent:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error fetching store content for admin" });
    }
};

/**
 * Updates a specific store content section.
 * Supported sections: support, delivery, bestSellers, offersDeals, contact.
 * Route: PUT /api/store-content/admin/section/:section
 * Access: Protected (Admin only)
 */
export const updateAdminSection = async (req, res) => {
    try {
        const { section } = req.params;
        const payload = (req.body && req.body.sectionData) ? req.body.sectionData : req.body;

        const allowedSections = ['support', 'delivery', 'bestSellers', 'offersDeals', 'contact'];
        if (!allowedSections.includes(section)) {
            return res.status(400).json({
                success: false,
                message: `Invalid section '${section}'. Must be one of: ${allowedSections.join(', ')}`
            });
        }

        let content = await StoreContent.findOne();
        if (!content) {
            content = await StoreContent.getOrInitializeStoreContent();
        }

        // Section-specific validation and normalization
        if (section === 'support') {
            if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email.trim())) {
                return res.status(400).json({ success: false, message: "Please provide a valid support email address" });
            }
            if (payload.whatsapp) {
                const cleanDigits = String(payload.whatsapp).replace(/[^0-9]/g, '');
                payload.whatsappLink = cleanDigits ? `https://wa.me/${cleanDigits}` : '';
            }
            if (payload.address && !payload.businessAddress) {
                payload.businessAddress = payload.address;
            } else if (payload.businessAddress && !payload.address) {
                payload.address = payload.businessAddress;
            }
        } else if (section === 'contact') {
            if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email.trim())) {
                return res.status(400).json({ success: false, message: "Please provide a valid contact email address" });
            }
            if (payload.whatsapp) {
                const cleanDigits = String(payload.whatsapp).replace(/[^0-9]/g, '');
                payload.whatsappLink = cleanDigits ? `https://wa.me/${cleanDigits}` : '';
            }
            if (payload.heading && !payload.sectionHeading) {
                payload.sectionHeading = payload.heading;
            } else if (payload.sectionHeading && !payload.heading) {
                payload.heading = payload.sectionHeading;
            }
            if (payload.socialLinks && typeof payload.socialLinks === 'object') {
                if (payload.socialLinks.twitter && !payload.socialLinks.x) {
                    payload.socialLinks.x = payload.socialLinks.twitter;
                } else if (payload.socialLinks.x && !payload.socialLinks.twitter) {
                    payload.socialLinks.twitter = payload.socialLinks.x;
                }
            }
        } else if (section === 'delivery') {
            if (typeof payload.insideCityCharge === 'number' && payload.insideCityCharge < 0) {
                return res.status(400).json({ success: false, message: "Inside city delivery charge cannot be negative" });
            }
            if (typeof payload.outsideCityCharge === 'number' && payload.outsideCityCharge < 0) {
                return res.status(400).json({ success: false, message: "Outside city delivery charge cannot be negative" });
            }
            if (typeof payload.freeDeliveryThreshold === 'number' && payload.freeDeliveryThreshold < 0) {
                return res.status(400).json({ success: false, message: "Free delivery threshold cannot be negative" });
            }
            if (payload.insideCityCharge !== undefined) {
                payload.standardCharge = payload.insideCityCharge;
            }
            if (payload.deliveryZones && !payload.zones) {
                payload.zones = payload.deliveryZones;
            }
            if (Array.isArray(payload.zones)) {
                payload.zones = payload.zones.map(z => ({
                    ...z,
                    charge: typeof z.charge === 'number' ? z.charge : (typeof z.fee === 'number' ? z.fee : 60),
                    fee: typeof z.fee === 'number' ? z.fee : (typeof z.charge === 'number' ? z.charge : 60)
                }));
            }
        } else if (section === 'bestSellers') {
            if (typeof payload.productLimit === 'number' && (payload.productLimit < 1 || payload.productLimit > 48)) {
                return res.status(400).json({ success: false, message: "Best sellers product limit must be between 1 and 48" });
            }
        }

        // Strip metadata properties before assigning to subdocument
        const { _id, createdAt, updatedAt, ...cleanPayload } = payload;
        if (section === 'contact' && cleanPayload.socialLinks) {
            content.contact.socialLinks = {
                ...(content.contact.socialLinks?.toObject ? content.contact.socialLinks.toObject() : (content.contact.socialLinks || {})),
                ...cleanPayload.socialLinks
            };
            delete cleanPayload.socialLinks;
            content.markModified('contact.socialLinks');
        }
        Object.assign(content[section], cleanPayload);
        content.markModified(section);
        content.updatedBy = req.sellerEmail || "System Admin";

        await content.save();

        if (typeof logActivity === 'function') {
            logActivity(req, 'STORE_CONTENT_UPDATED', `Updated store content section: ${section}`);
        }

        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        return res.json({
            success: true,
            message: `Store content section '${section}' updated successfully`,
            content,
            data: content
        });
    } catch (error) {
        console.error("Error in updateAdminSection:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error updating store content section" });
    }
};

/**
 * Updates all payment methods or reorders them.
 * Route: PUT /api/store-content/admin/payments
 * Access: Protected (Admin only)
 */
export const updatePaymentMethods = async (req, res) => {
    try {
        const { paymentMethods } = req.body;
        if (!Array.isArray(paymentMethods)) {
            return res.status(400).json({ success: false, message: "paymentMethods must be an array" });
        }

        let content = await StoreContent.findOne();
        if (!content) {
            content = await StoreContent.getOrInitializeStoreContent();
        }

        const sanitized = paymentMethods.map((m, idx) => ({
            id: m.id || m.methodCode || `method_${idx}`,
            name: m.name,
            logo: m.logo || "",
            description: m.description || "",
            instructions: m.instructions || "",
            isActive: m.isActive !== false,
            isCheckoutSupported: m.isCheckoutSupported || m.type === 'checkout',
            type: (m.isCheckoutSupported || m.type === 'checkout') ? 'checkout' : 'informational',
            displayOrder: typeof m.displayOrder === 'number' ? m.displayOrder : idx
        }));

        content.paymentMethods = sanitized;
        content.markModified('paymentMethods');
        content.updatedBy = req.sellerEmail || "System Admin";
        await content.save();

        if (typeof logActivity === 'function') {
            logActivity(req, 'STORE_PAYMENTS_UPDATED', `Updated ${paymentMethods.length} payment methods configuration`);
        }

        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        return res.json({
            success: true,
            message: "Payment methods updated successfully",
            paymentMethods: content.paymentMethods
        });
    } catch (error) {
        console.error("Error in updatePaymentMethods:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error updating payment methods" });
    }
};

/**
 * Adds a new FAQ.
 * Route: POST /api/store-content/admin/faqs
 * Access: Protected (Admin only)
 */
export const createFAQ = async (req, res) => {
    try {
        const { question, answer, category, displayOrder, isPublished } = req.body;

        if (!question?.trim() || question.trim().length < 5) {
            return res.status(400).json({ success: false, message: "Question must be at least 5 characters long" });
        }
        if (!answer?.trim() || answer.trim().length < 5) {
            return res.status(400).json({ success: false, message: "Answer must be at least 5 characters long" });
        }

        let content = await StoreContent.findOne();
        if (!content) {
            content = await StoreContent.getOrInitializeStoreContent();
        }

        const newFaq = {
            question: question.trim(),
            answer: answer.trim(),
            category: category?.trim() || "General",
            displayOrder: Number(displayOrder) || (content.faqs.length + 1),
            isPublished: isPublished !== false
        };

        content.faqs.push(newFaq);
        content.updatedBy = req.sellerEmail || "System Admin";
        await content.save();

        const createdItem = content.faqs[content.faqs.length - 1];

        if (typeof logActivity === 'function') {
            logActivity(req, 'FAQ_CREATED', `Created new FAQ: "${question.substring(0, 40)}..."`);
        }

        return res.json({
            success: true,
            message: "FAQ created successfully",
            faq: createdItem,
            faqs: content.faqs
        });
    } catch (error) {
        console.error("Error in createFAQ:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error creating FAQ" });
    }
};

/**
 * Updates an existing FAQ by ID.
 * Route: PUT /api/store-content/admin/faqs/:id
 * Access: Protected (Admin only)
 */
export const updateFAQ = async (req, res) => {
    try {
        const { id } = req.params;
        const { question, answer, category, displayOrder, isPublished } = req.body;

        let content = await StoreContent.findOne();
        if (!content) {
            return res.status(404).json({ success: false, message: "Store content uninitialized" });
        }

        const faq = content.faqs.id(id);
        if (!faq) {
            return res.status(404).json({ success: false, message: "FAQ not found" });
        }

        if (question !== undefined) {
            if (!question?.trim() || question.trim().length < 5) {
                return res.status(400).json({ success: false, message: "Question must be at least 5 characters long" });
            }
            faq.question = question.trim();
        }

        if (answer !== undefined) {
            if (!answer?.trim() || answer.trim().length < 5) {
                return res.status(400).json({ success: false, message: "Answer must be at least 5 characters long" });
            }
            faq.answer = answer.trim();
        }

        if (category !== undefined) faq.category = category.trim();
        if (displayOrder !== undefined) faq.displayOrder = Number(displayOrder);
        if (isPublished !== undefined) faq.isPublished = Boolean(isPublished);

        content.updatedBy = req.sellerEmail || "System Admin";
        await content.save();

        if (typeof logActivity === 'function') {
            logActivity(req, 'FAQ_UPDATED', `Updated FAQ: "${faq.question.substring(0, 40)}..."`);
        }

        return res.json({
            success: true,
            message: "FAQ updated successfully",
            faq,
            faqs: content.faqs
        });
    } catch (error) {
        console.error("Error in updateFAQ:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error updating FAQ" });
    }
};

/**
 * Deletes an FAQ by ID.
 * Route: DELETE /api/store-content/admin/faqs/:id
 * Access: Protected (Admin only)
 */
export const deleteFAQ = async (req, res) => {
    try {
        const { id } = req.params;

        let content = await StoreContent.findOne();
        if (!content) {
            return res.status(404).json({ success: false, message: "Store content uninitialized" });
        }

        const faq = content.faqs.id(id);
        if (!faq) {
            return res.status(404).json({ success: false, message: "FAQ not found" });
        }

        const questionSnippet = faq.question.substring(0, 40);
        content.faqs.pull(id);
        content.updatedBy = req.sellerEmail || "System Admin";
        await content.save();

        if (typeof logActivity === 'function') {
            logActivity(req, 'FAQ_DELETED', `Deleted FAQ: "${questionSnippet}..."`);
        }

        return res.json({
            success: true,
            message: "FAQ deleted successfully",
            faqs: content.faqs
        });
    } catch (error) {
        console.error("Error in deleteFAQ:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error deleting FAQ" });
    }
};
