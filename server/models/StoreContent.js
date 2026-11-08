import mongoose from "mongoose";

const faqSchema = new mongoose.Schema({
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
    category: { type: String, default: "General", trim: true },
    displayOrder: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true }
}, { timestamps: true });

const paymentMethodSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    logo: { type: String, default: "" },
    description: { type: String, default: "" },
    instructions: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    isCheckoutSupported: { type: Boolean, default: false },
    type: { type: String, default: "informational" },
    displayOrder: { type: Number, default: 0 }
});

const deliveryZoneSchema = new mongoose.Schema({
    name: { type: String, required: true },
    areas: [{ type: String }],
    estimatedTime: { type: String, default: "24–48 Hours" },
    charge: { type: Number, default: 60 },
    fee: { type: Number, default: 60 },
    freeDeliveryAbove: { type: Number, default: 1000 }
});

const storeContentSchema = new mongoose.Schema({
    // 1. Customer Support Management
    support: {
        title: { type: String, default: "Customer Support & Helpdesk" },
        description: { type: String, default: "We are committed to delivering the freshest groceries and supporting your shopping experience 7 days a week." },
        phone: { type: String, default: "+880 1700-000000" },
        email: { type: String, default: "support@greencart.com" },
        whatsapp: { type: String, default: "+880 1700-000000" },
        whatsappLink: { type: String, default: "https://wa.me/8801700000000" },
        businessHours: { type: String, default: "8:00 AM - 10:00 PM (Everyday)" },
        businessAddress: { type: String, default: "GreenCart Central Logistics Hub, Tejgaon, Dhaka, Bangladesh" },
        address: { type: String, default: "GreenCart Central Logistics Hub, Tejgaon, Dhaka, Bangladesh" },
        instructions: { type: String, default: "For urgent order inquiries, please have your Order ID ready when contacting our support agents." },
        isPublished: { type: Boolean, default: true }
    },

    // 2. Delivery Information Management
    delivery: {
        title: { type: String, default: "Fast, Reliable & Temperature-Safe Grocery Delivery" },
        description: { type: String, default: "GreenCart delivers farm-fresh organic produce, chilled dairy, and pantry essentials directly to your doorstep." },
        standardCharge: { type: Number, default: 60 },
        insideCityCharge: { type: Number, default: 60 },
        outsideCityCharge: { type: Number, default: 120 },
        expressCharge: { type: Number, default: 150 },
        freeDeliveryThreshold: { type: Number, default: 1000 },
        estimatedTimeInsideCity: { type: String, default: "24–48 Hours" },
        estimatedTimeOutsideCity: { type: String, default: "48–72 Hours" },
        estimatedTimeExpress: { type: String, default: "60–90 Minutes" },
        zones: {
            type: [deliveryZoneSchema],
            default: [
                {
                    name: "Dhaka North Express Zone",
                    areas: ["Gulshan", "Banani", "Baridhara", "Uttara", "Nikunja", "Bashundhara"],
                    estimatedTime: "Same-Day / 24 Hours",
                    charge: 60,
                    freeDeliveryAbove: 1000
                },
                {
                    name: "Dhaka South & Central Zone",
                    areas: ["Dhanmondi", "Mohammadpur", "Mirpur", "Tejgaon", "Khilgaon", "Motijheel"],
                    estimatedTime: "24–48 Hours",
                    charge: 60,
                    freeDeliveryAbove: 1000
                },
                {
                    name: "Greater Dhaka & Suburbs",
                    areas: ["Savar", "Gazipur", "Keraniganj", "Narayanganj"],
                    estimatedTime: "48–72 Hours",
                    charge: 120,
                    freeDeliveryAbove: 1500
                }
            ]
        },
        instructions: { type: String, default: "Perishable vegetables, fruits, and dairy products are transported in temperature-regulated containers to guarantee farm freshness." },
        isPublished: { type: Boolean, default: true }
    },

    // 3. Payment Methods Management
    paymentMethods: {
        type: [paymentMethodSchema],
        default: [
            {
                id: "cod",
                name: "Cash on Delivery (COD)",
                logo: "cash",
                description: "Pay in cash or via mobile wallet directly to the delivery courier after doorstep package inspection.",
                instructions: "Please keep the exact amount ready upon delivery for quick contactless handover.",
                isActive: true,
                isCheckoutSupported: true,
                displayOrder: 1
            },
            {
                id: "bkash",
                name: "bKash Mobile Banking",
                logo: "bkash",
                description: "Instant mobile payment via bKash. Supported via digital checkout and merchant payment transfer.",
                instructions: "Pay to GreenCart Merchant Account: 01700-000000 using your bKash App or dialing *247#.",
                isActive: true,
                isCheckoutSupported: false,
                displayOrder: 2
            },
            {
                id: "nagad",
                name: "Nagad Digital Payment",
                logo: "nagad",
                description: "Fast and secure government postal digital banking payment with instant confirmation.",
                instructions: "Use Nagad App or dial *167# to complete merchant payment to GreenCart.",
                isActive: true,
                isCheckoutSupported: false,
                displayOrder: 3
            },
            {
                id: "bank",
                name: "Direct Bank Transfer",
                logo: "bank",
                description: "Electronic bank transfer (NPSB / BEFTN) designed for wholesale and family monthly grocery bundles.",
                instructions: "Transfer to GreenCart Ltd, Account: 105-123456789, City Bank Bangladesh. Reference your Order ID.",
                isActive: true,
                isCheckoutSupported: false,
                displayOrder: 4
            }
        ]
    },

    // 4. Best Sellers Settings
    bestSellers: {
        title: { type: String, default: "Best Sellers" },
        subtitle: { type: String, default: "Customer-favorite groceries and daily kitchen staples verified by actual sales data" },
        isVisible: { type: Boolean, default: true },
        productLimit: { type: Number, default: 8, min: 4, max: 24 },
        displayOrder: { type: Number, default: 1 },
        bannerImage: { type: String, default: "" }
    },

    // 5. Offers & Deals Settings
    offersDeals: {
        title: { type: String, default: "Special Offers & Voucher Deals" },
        subtitle: { type: String, default: "Claim active discount vouchers and save big on your household grocery budget" },
        bannerText: { type: String, default: "Limited time offers! Apply promo codes at checkout for instant savings." },
        isVisible: { type: Boolean, default: true },
        bannerImage: { type: String, default: "" },
        displayOrder: { type: Number, default: 1 }
    },

    // 6. Contact Us Settings
    contact: {
        title: { type: String, default: "Get in Touch with GreenCart" },
        description: { type: String, default: "Have questions about our produce, your delivery, or corporate grocery orders? We'd love to hear from you." },
        phone: { type: String, default: "+880 1700-000000" },
        email: { type: String, default: "contact@greencart.com" },
        whatsapp: { type: String, default: "+880 1700-000000" },
        whatsappLink: { type: String, default: "https://wa.me/880170000000" },
        address: { type: String, default: "GreenCart Central Logistics Hub, Tejgaon Industrial Area, Dhaka 1208, Bangladesh" },
        googleMapsUrl: { type: String, default: "https://maps.google.com/?q=Tejgaon+Dhaka" },
        businessHours: { type: String, default: "Saturday - Thursday: 8:00 AM - 10:00 PM, Friday: 9:00 AM - 8:00 PM" },
        heading: { type: String, default: "We're Here to Help" },
        sectionHeading: { type: String, default: "We're Here to Help" },
        sectionDescription: { type: String, default: "Fill out the form below and our team will get back to you within 24 hours." },
        instructions: { type: String, default: "" },
        announcement: { type: String, default: "" },
        socialLinks: {
            facebook: { type: String, default: "https://facebook.com/greencart" },
            instagram: { type: String, default: "https://instagram.com/greencart" },
            twitter: { type: String, default: "https://twitter.com/greencart" },
            x: { type: String, default: "https://x.com/greencart" },
            youtube: { type: String, default: "https://youtube.com/greencart" },
            linkedin: { type: String, default: "https://linkedin.com/company/greencart" }
        },
        isPublished: { type: Boolean, default: true }
    },

    // 7. FAQs
    faqs: {
        type: [faqSchema],
        default: [
            {
                question: "How do I place a grocery order on GreenCart?",
                answer: "Browse our fresh categories or search for items, click 'Add to Cart', and proceed to Checkout. Enter your delivery address, choose your payment option, and confirm your order. You will receive an instant order confirmation.",
                category: "Orders & Delivery",
                displayOrder: 1,
                isPublished: true
            },
            {
                question: "What are your delivery charges and how do I get Free Delivery?",
                answer: "Standard delivery inside Dhaka is BDT 60. Orders over BDT 1,000 qualify for 100% Free Doorstep Delivery! Outside city delivery is BDT 120 with free delivery on orders above BDT 1,500.",
                category: "Orders & Delivery",
                displayOrder: 2,
                isPublished: true
            },
            {
                question: "Can I inspect my grocery items before making payment?",
                answer: "Yes, absolutely! With Cash on Delivery, our delivery agent will wait while you inspect the freshness and condition of your items. If anything is unsatisfactory, you may return it on the spot.",
                category: "Orders & Delivery",
                displayOrder: 3,
                isPublished: true
            },
            {
                question: "What payment methods are supported?",
                answer: "We support Cash on Delivery (COD) as our primary checkout payment method. Informational support is also available for bKash, Nagad, and Direct Bank Transfer for bulk purchases.",
                category: "Payments",
                displayOrder: 4,
                isPublished: true
            },
            {
                question: "How does the Return and Refund process work?",
                answer: "You can request a return directly from 'My Orders' within 7 days of receiving your delivery for eligible reasons like damaged, wrong, or expired items. Our courier will pick up the item and your refund will be processed promptly.",
                category: "Returns & Refunds",
                displayOrder: 5,
                isPublished: true
            },
            {
                question: "How long does refund processing take?",
                answer: "Once the returned items are physically inspected at our hub, refunds are completed within 3–5 business days to your original payment method or issued as store credit.",
                category: "Returns & Refunds",
                displayOrder: 6,
                isPublished: true
            },
            {
                question: "How do I apply a promotional coupon code?",
                answer: "Visit the Offers & Deals page to view all verified active coupons. Copy your desired coupon code and paste it into the 'Have a coupon?' field during checkout to enjoy instant discounts.",
                category: "Offers & Coupons",
                displayOrder: 7,
                isPublished: true
            },
            {
                question: "How can I contact customer support if I have a question?",
                answer: "Our customer support team is available everyday from 8:00 AM to 10:00 PM via live chat, WhatsApp (+880 1700-000000), phone, and email at support@greencart.com.",
                category: "Customer Support",
                displayOrder: 8,
                isPublished: true
            }
        ]
    },

    updatedBy: { type: String, default: "System Admin" }
}, {
    timestamps: true
});

/**
 * Singleton pattern helper to retrieve active store content or create default document.
 */
storeContentSchema.statics.getOrInitializeStoreContent = async function () {
    let content = await this.findOne();
    if (!content) {
        content = await this.create({
            updatedBy: "System Initializer"
        });
    }
    return content;
};

const StoreContent = mongoose.models.StoreContent || mongoose.model("StoreContent", storeContentSchema);

export default StoreContent;
