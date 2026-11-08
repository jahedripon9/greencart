import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import {
    createNotification,
    notifyNewOrder,
    notifyLowStock,
    resetLowStockDeduplication,
    notifyNewCustomer,
    notifyPendingOrderReminder,
    notifySystemEvent,
    checkPendingOrderReminders,
    startPendingOrderScheduler,
    stopPendingOrderScheduler
} from "../services/notificationService.js";
import {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    getCallerNotificationScope
} from "../controllers/notificationController.js";

test("GreenCart Smart Notification Center Suite", async (t) => {
    // In-memory store for unit test mocking
    let mockNotifications = [];

    // Mock Notification methods
    Notification.create = async (doc) => {
        const item = {
            _id: new mongoose.Types.ObjectId(),
            sellerId: null,
            isRead: false,
            readBy: [],
            ...doc,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        mockNotifications.push(item);
        return item;
    };

    Notification.findOne = async (query) => {
        if (query.dedupeKey) {
            return mockNotifications.find(n => n.dedupeKey === query.dedupeKey) || null;
        }
        if (query._id) {
            return mockNotifications.find(n => String(n._id) === String(query._id)) || null;
        }
        return null;
    };

    Notification.find = (query) => {
        let results = mockNotifications.filter(n => {
            if (query.sellerId !== undefined && n.sellerId !== query.sellerId) return false;
            if (query.isRead !== undefined && n.isRead !== query.isRead) return false;
            if (query.type) {
                if (typeof query.type === 'object' && query.type.$in) {
                    if (!query.type.$in.includes(n.type)) return false;
                } else if (n.type !== query.type) {
                    return false;
                }
            }
            return true;
        });

        return {
            sort: () => ({
                skip: (skipNum) => ({
                    limit: (limitNum) => ({
                        lean: async () => results.slice(skipNum, skipNum + limitNum)
                    })
                })
            })
        };
    };

    Notification.countDocuments = async (query) => {
        return mockNotifications.filter(n => {
            if (query.sellerId !== undefined && n.sellerId !== query.sellerId) return false;
            if (query.isRead !== undefined && n.isRead !== query.isRead) return false;
            if (query.type) {
                if (typeof query.type === 'object' && query.type.$in) {
                    if (!query.type.$in.includes(n.type)) return false;
                } else if (n.type !== query.type) {
                    return false;
                }
            }
            return true;
        }).length;
    };

    Notification.findOneAndUpdate = async (filter, update) => {
        const index = mockNotifications.findIndex(n => {
            if (filter._id && String(n._id) !== String(filter._id)) return false;
            if (filter.sellerId !== undefined && n.sellerId !== filter.sellerId) return false;
            return true;
        });

        if (index === -1) return null;

        const target = mockNotifications[index];
        if (update.$set) {
            Object.assign(target, update.$set);
        }
        if (update.$addToSet && update.$addToSet.readBy) {
            target.readBy = target.readBy || [];
            if (!target.readBy.includes(update.$addToSet.readBy)) {
                target.readBy.push(update.$addToSet.readBy);
            }
        }
        return target;
    };

    Notification.updateMany = async (filter, update) => {
        let count = 0;
        for (const target of mockNotifications) {
            if (filter.sellerId !== undefined && target.sellerId !== filter.sellerId) continue;
            if (filter.isRead !== undefined && target.isRead !== filter.isRead) continue;
            if (filter.type !== undefined && target.type !== filter.type) continue;
            if (filter.dedupeKey !== undefined) {
                if (filter.dedupeKey.$in && !filter.dedupeKey.$in.includes(target.dedupeKey)) continue;
                if (!filter.dedupeKey.$in && target.dedupeKey !== filter.dedupeKey) continue;
            }

            if (update.$set) Object.assign(target, update.$set);
            if (update.$addToSet && update.$addToSet.readBy) {
                target.readBy = target.readBy || [];
                if (!target.readBy.includes(update.$addToSet.readBy)) {
                    target.readBy.push(update.$addToSet.readBy);
                }
            }
            count++;
        }
        return { modifiedCount: count };
    };

    Notification.findOneAndDelete = async (filter) => {
        const index = mockNotifications.findIndex(n => {
            if (filter._id && String(n._id) !== String(filter._id)) return false;
            if (filter.sellerId !== undefined && n.sellerId !== filter.sellerId) return false;
            return true;
        });
        if (index === -1) return null;
        const [deleted] = mockNotifications.splice(index, 1);
        return deleted;
    };

    t.beforeEach(() => {
        mockNotifications = [];
    });

    // -------------------------------------------------------------------------
    // 1. Notification Creation for Supported Events
    // -------------------------------------------------------------------------
    await t.test("1. Event Creation & Dispatch", async (t2) => {
        await t2.test("1.1 notifyNewOrder creates notifications for Admin and distinct Sellers", async () => {
            const fakeOrder = {
                _id: new mongoose.Types.ObjectId(),
                orderNumber: "GC-1001",
                amount: 1500,
                items: [
                    { product: new mongoose.Types.ObjectId(), sellerId: "seller_alpha" },
                    { product: new mongoose.Types.ObjectId(), sellerId: "seller_beta" }
                ]
            };

            const notifs = await notifyNewOrder({
                order: fakeOrder,
                customerName: "Jane Doe"
            });

            assert.equal(notifs.length, 3, "Should create 1 admin notification and 2 seller notifications");

            const adminNotif = notifs.find(n => n.sellerId === null);
            assert.ok(adminNotif, "Admin notification must exist with sellerId: null");
            assert.equal(adminNotif.type, "order");
            assert.ok(adminNotif.title.includes("GC-1001"));
            assert.equal(adminNotif.data.amount, 1500);

            const sellerAlpha = notifs.find(n => n.sellerId === "seller_alpha");
            assert.ok(sellerAlpha, "Seller Alpha notification must exist");
            assert.equal(sellerAlpha.data.orderNumber, "GC-1001");
        });

        await t2.test("1.2 notifyLowStock triggers when stock <= threshold", async () => {
            const fakeProduct = {
                _id: new mongoose.Types.ObjectId(),
                name: "Organic Honey 500g",
                stockQuantity: 3,
                lowStockThreshold: 5,
                sellerId: "seller_honey"
            };

            const notifs = await notifyLowStock({
                product: fakeProduct,
                currentStock: 3,
                threshold: 5
            });

            assert.equal(notifs.length, 2, "Should notify both Admin and Tenant Seller");
            const adminNotif = notifs.find(n => n.sellerId === null);
            assert.ok(adminNotif.title.includes("Low Stock Alert"));
            assert.equal(adminNotif.type, "low_stock");
            assert.equal(adminNotif.data.stockQuantity, 3);
        });

        await t2.test("1.3 notifyLowStock triggers Out of Stock title when stock is 0", async () => {
            const fakeProduct = {
                _id: new mongoose.Types.ObjectId(),
                name: "Fresh Spinach",
                stockQuantity: 0,
                lowStockThreshold: 5,
                sellerId: "seller_farm"
            };

            const notifs = await notifyLowStock({
                product: fakeProduct,
                currentStock: 0,
                threshold: 5
            });

            assert.ok(notifs[0].title.includes("Out of Stock"), "Title must indicate Out of Stock");
        });

        await t2.test("1.4 notifyNewCustomer triggers when new customer directory entry is added", async () => {
            const fakeCustomer = {
                userId: "user_789",
                name: "Alice Smith",
                email: "alice@example.com",
                phone: "+8801700000000"
            };
            const fakeOrder = {
                _id: new mongoose.Types.ObjectId(),
                orderNumber: "GC-2002"
            };

            const notifs = await notifyNewCustomer({
                customer: fakeCustomer,
                order: fakeOrder,
                sellerId: "seller_main"
            });

            assert.equal(notifs.length, 2, "Notifies Admin and Seller");
            assert.equal(notifs[0].type, "new_customer");
            assert.ok(notifs[0].message.includes("Alice Smith"));
            assert.equal(notifs[0].data.customerEmail, "alice@example.com");
        });

        await t2.test("1.5 notifyPendingOrderReminder creates reminder with order link and hours", async () => {
            const fakeOrder = {
                _id: new mongoose.Types.ObjectId(),
                orderNumber: "GC-3003",
                amount: 850
            };

            const notifs = await notifyPendingOrderReminder({
                order: fakeOrder,
                hoursPending: 36,
                sellerId: "seller_alpha"
            });

            assert.equal(notifs.length, 2);
            assert.equal(notifs[0].type, "pending_reminder");
            assert.ok(notifs[0].message.includes("36 hours"));
            assert.equal(notifs[0].data.link, "/seller/orders");
        });

        await t2.test("1.6 notifySystemEvent creates system alert without exposing private secrets", async () => {
            const notif = await notifySystemEvent({
                title: "Security Notice: Session Revoked",
                message: "Root merchant sessions revoked by administrator.",
                data: { link: "/seller/team" },
                dedupeKey: "sys_test_1"
            });

            assert.ok(notif);
            assert.equal(notif.type, "system");
            assert.equal(notif.sellerId, null);
            assert.ok(!JSON.stringify(notif).includes("password"));
            assert.ok(!JSON.stringify(notif).includes("secret"));
        });
    });

    // -------------------------------------------------------------------------
    // 2. Deduplication Safeguards
    // -------------------------------------------------------------------------
    await t.test("2. Deduplication Safeguards", async (t2) => {
        await t2.test("2.1 prevents duplicate new order alerts for the same order", async () => {
            const fakeOrder = {
                _id: new mongoose.Types.ObjectId(),
                orderNumber: "GC-DUP-01",
                amount: 500,
                items: [{ product: new mongoose.Types.ObjectId(), sellerId: "seller_x" }]
            };

            const firstRun = await notifyNewOrder({ order: fakeOrder, customerName: "Bob" });
            assert.equal(firstRun.length, 2);

            const secondRun = await notifyNewOrder({ order: fakeOrder, customerName: "Bob" });
            // Since mock returns existing, no new items were appended to mockNotifications
            assert.equal(mockNotifications.length, 2, "Must not append duplicate notifications in store");
        });

        await t2.test("2.2 prevents repeated low stock alerts for the same product while in low stock", async () => {
            const prodId = new mongoose.Types.ObjectId();
            const fakeProduct = {
                _id: prodId,
                name: "Organic Rice",
                stockQuantity: 2,
                lowStockThreshold: 5,
                sellerId: "seller_grain"
            };

            await notifyLowStock({ product: fakeProduct, currentStock: 2, threshold: 5 });
            const countAfterFirst = mockNotifications.length;

            await notifyLowStock({ product: fakeProduct, currentStock: 2, threshold: 5 });
            assert.equal(mockNotifications.length, countAfterFirst, "Count must remain unchanged on duplicate check");
        });

        await t2.test("2.3 prevents duplicate pending order reminders within the same reminder interval", async () => {
            const fakeOrder = {
                _id: new mongoose.Types.ObjectId(),
                orderNumber: "GC-REM-01",
                amount: 720
            };

            await notifyPendingOrderReminder({ order: fakeOrder, hoursPending: 28, sellerId: "seller_1" });
            const countAfterFirst = mockNotifications.length;

            await notifyPendingOrderReminder({ order: fakeOrder, hoursPending: 29, sellerId: "seller_1" });
            assert.equal(mockNotifications.length, countAfterFirst, "Same day reminder must be deduplicated");
        });

        await t2.test("2.4 restocking above threshold resets dedupe key and subsequent low stock emits new alert", async () => {
            const prodId = new mongoose.Types.ObjectId();
            const fakeProduct = {
                _id: prodId,
                name: "Premium Cashews",
                stockQuantity: 3,
                lowStockThreshold: 5,
                sellerId: "seller_nuts"
            };

            // 1. Initial drop into low stock (stock = 3 <= 5)
            const initialAlerts = await notifyLowStock({ product: fakeProduct, currentStock: 3, threshold: 5 });
            assert.equal(initialAlerts.length, 2, "Emits alert to Admin and Seller");
            assert.equal(mockNotifications.length, 2);

            // 2. Same low stock condition (stock = 2 <= 5) -> must be deduplicated
            await notifyLowStock({ product: fakeProduct, currentStock: 2, threshold: 5 });
            assert.equal(mockNotifications.length, 2, "Must not create duplicate while continuously in low stock");

            // 3. Restock above threshold (stock = 25 > 5) -> resets dedupeKey to null while keeping notifications in DB
            const restockResult = await notifyLowStock({ product: fakeProduct, currentStock: 25, threshold: 5 });
            assert.equal(restockResult.length, 0, "Healthy stock emits no alerts");
            assert.equal(mockNotifications.length, 2, "Historical records are preserved");
            assert.equal(mockNotifications[0].dedupeKey, null, "Active dedupeKey must be cleared on restock");
            assert.equal(mockNotifications[1].dedupeKey, null, "Seller dedupeKey must be cleared on restock");

            // 4. Subsequent transition back into low stock (stock = 4 <= 5) -> MUST create new notifications!
            const newCycleAlerts = await notifyLowStock({ product: fakeProduct, currentStock: 4, threshold: 5 });
            assert.equal(newCycleAlerts.length, 2, "New cycle must generate fresh notifications");
            assert.equal(mockNotifications.length, 4, "Store now has both historical and new alerts");

            // 5. Further drop in new cycle (stock = 1 <= 5) -> deduplicated against new cycle's alert
            await notifyLowStock({ product: fakeProduct, currentStock: 1, threshold: 5 });
            assert.equal(mockNotifications.length, 4, "Must deduplicate within the new cycle");
        });

        await t2.test("2.5 automatic pending order scheduler starts and stops cleanly with unref", async () => {
            const oldEnv = process.env.NODE_ENV;
            try {
                process.env.NODE_ENV = 'production';
                const timer = startPendingOrderScheduler(3600000);
                assert.ok(timer, "Scheduler returns an active timer instance in production");

                // Calling again returns the existing singleton timer
                const timer2 = startPendingOrderScheduler(3600000);
                assert.equal(timer, timer2, "Scheduler maintains single active interval");

                stopPendingOrderScheduler();
                // After stop, calling start works again
                const timer3 = startPendingOrderScheduler(3600000);
                assert.ok(timer3);
                stopPendingOrderScheduler();
            } finally {
                process.env.NODE_ENV = oldEnv;
                stopPendingOrderScheduler();
            }
        });
    });

    // -------------------------------------------------------------------------
    // 3. Controller Actions & Read/Unread Flow
    // -------------------------------------------------------------------------
    await t.test("3. Controller Endpoints & Operations", async (t2) => {
        await t2.test("3.1 getNotifications returns paginated results and unreadCount", async () => {
            // Seed notifications
            await createNotification({ type: "order", title: "Order 1", message: "Msg 1" });
            await createNotification({ type: "low_stock", title: "Stock 1", message: "Msg 2" });

            const req = {
                sellerId: "admin@greencart.com",
                sellerEmail: "admin@greencart.com",
                sellerRole: "Admin",
                query: { page: "1", limit: "10" }
            };

            let responseData = null;
            const res = {
                json: (data) => { responseData = data; return res; },
                status: () => res
            };

            await getNotifications(req, res);
            assert.equal(responseData.success, true);
            assert.equal(responseData.notifications.length, 2);
            assert.equal(responseData.unreadCount, 2);
            assert.equal(responseData.pagination.page, 1);
        });

        await t2.test("3.2 getNotifications filters by type and unread state", async () => {
            await createNotification({ type: "order", title: "Order A", message: "Msg", sellerId: null });
            await createNotification({ type: "low_stock", title: "Stock A", message: "Msg", sellerId: null });

            const req = {
                sellerId: "admin@greencart.com",
                sellerRole: "Admin",
                query: { filter: "orders" }
            };

            let responseData = null;
            const res = {
                json: (data) => { responseData = data; return res; },
                status: () => res
            };

            await getNotifications(req, res);
            assert.equal(responseData.success, true);
            assert.equal(responseData.notifications.length, 1);
            assert.equal(responseData.notifications[0].type, "order");
        });

        await t2.test("3.3 markAsRead marks specific notification as read", async () => {
            const notif = await createNotification({ type: "order", title: "Order Test", message: "Msg" });
            assert.equal(notif.isRead, false);

            const req = {
                params: { id: String(notif._id) },
                sellerId: "admin_1",
                sellerRole: "Admin"
            };

            let responseData = null;
            const res = {
                json: (data) => { responseData = data; return res; },
                status: () => res
            };

            await markAsRead(req, res);
            assert.equal(responseData.success, true);
            assert.equal(responseData.notification.isRead, true);
            assert.ok(responseData.notification.readAt instanceof Date);
        });

        await t2.test("3.4 markAsRead rejects malformed ObjectId with 400", async () => {
            const req = {
                params: { id: "not-a-valid-id" },
                sellerId: "admin_1",
                sellerRole: "Admin"
            };

            let statusCode = 200;
            let responseData = null;
            const res = {
                status: (code) => { statusCode = code; return res; },
                json: (data) => { responseData = data; return res; }
            };

            await markAsRead(req, res);
            assert.equal(statusCode, 400);
            assert.equal(responseData.success, false);
        });

        await t2.test("3.5 markAllAsRead updates all unread notifications in caller's scope", async () => {
            await createNotification({ type: "order", title: "Order 1", message: "Msg 1" });
            await createNotification({ type: "order", title: "Order 2", message: "Msg 2" });

            const req = {
                sellerId: "admin@greencart.com",
                sellerRole: "Admin"
            };

            let responseData = null;
            const res = {
                json: (data) => { responseData = data; return res; },
                status: () => res
            };

            await markAllAsRead(req, res);
            assert.equal(responseData.success, true);
            assert.equal(responseData.modifiedCount, 2);

            // Verify they are all read
            assert.ok(mockNotifications.every(n => n.isRead === true));
        });

        await t2.test("3.6 deleteNotification deletes individual notification", async () => {
            const notif = await createNotification({ type: "system", title: "Sys Notice", message: "Delete me" });
            const initialCount = mockNotifications.length;

            const req = {
                params: { id: String(notif._id) },
                sellerId: "admin@greencart.com",
                sellerRole: "Admin"
            };

            let responseData = null;
            const res = {
                json: (data) => { responseData = data; return res; },
                status: () => res
            };

            await deleteNotification(req, res);
            assert.equal(responseData.success, true);
            assert.equal(mockNotifications.length, initialCount - 1);
        });
    });

    // -------------------------------------------------------------------------
    // 4. Admin and Tenant Seller Data Isolation
    // -------------------------------------------------------------------------
    await t.test("4. Cross-Seller Isolation & Access Control", async (t2) => {
        await t2.test("4.1 getCallerNotificationScope grants platform scope to Admin and CEO roles", () => {
            const adminScope = getCallerNotificationScope({ sellerRole: "Admin", isTeamMember: true });
            assert.equal(adminScope.isStoreAdmin, true);
            assert.deepEqual(adminScope.query, {});

            const ceoScope = getCallerNotificationScope({ sellerRole: "CEO", isTeamMember: true });
            assert.equal(ceoScope.isStoreAdmin, true);
            assert.deepEqual(ceoScope.query, {});
        });

        await t2.test("4.2 getCallerNotificationScope strictly isolates tenant seller to their sellerId", () => {
            const sellerScope = getCallerNotificationScope({
                sellerId: "seller_isolated_123",
                sellerRole: null,
                isTeamMember: false
            });

            assert.equal(sellerScope.isStoreAdmin, false);
            assert.deepEqual(sellerScope.query, { sellerId: "seller_isolated_123" });
        });

        await t2.test("4.3 tenant seller cannot access notifications of another seller", async () => {
            // Seed a notification for Seller Alpha and a notification for Seller Beta
            await createNotification({ type: "order", title: "Alpha Order", message: "Msg", sellerId: "seller_alpha" });
            const betaNotif = await createNotification({ type: "order", title: "Beta Order", message: "Msg", sellerId: "seller_beta" });

            // Seller Alpha requests their notifications
            const reqAlpha = {
                sellerId: "seller_alpha",
                sellerRole: null,
                query: {}
            };

            let listResult = null;
            const res = {
                json: (data) => { listResult = data; return res; },
                status: () => res
            };

            await getNotifications(reqAlpha, res);
            assert.equal(listResult.notifications.length, 1);
            assert.equal(listResult.notifications[0].sellerId, "seller_alpha");

            // Seller Alpha tries to mark Seller Beta's notification as read
            let patchStatus = 200;
            let patchResult = null;
            const patchRes = {
                status: (code) => { patchStatus = code; return patchRes; },
                json: (data) => { patchResult = data; return patchRes; }
            };

            await markAsRead({
                params: { id: String(betaNotif._id) },
                sellerId: "seller_alpha",
                sellerRole: null
            }, patchRes);

            assert.equal(patchStatus, 404, "Must deny cross-seller mutation with 404/access denied");
        });

        await t2.test("4.4 client-supplied sellerId in query params is ignored for tenant sellers", async () => {
            const tenantReq = {
                sellerId: "seller_legit_id",
                sellerRole: null,
                query: { sellerId: "seller_spoofed_admin" } // Attack attempt
            };

            const resolved = getCallerNotificationScope(tenantReq);
            assert.equal(resolved.query.sellerId, "seller_legit_id", "Must never trust client-supplied sellerId");
        });
    });
});
