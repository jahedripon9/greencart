import { fileURLToPath } from 'node:url';
import path from 'node:path';
import mongoose from 'mongoose';
import 'dotenv/config';
import Product from '../models/Product.js';
import Order from '../models/Order.js';

/**
 * Checks the number of records requiring migration for Phase 7 stock management.
 */
export async function checkMigrationStatus({
    ProductModel = Product,
    OrderModel = Order,
    logger = console
} = {}) {
    const productsWithoutStockQuantity = await ProductModel.countDocuments({
        stockQuantity: { $exists: false }
    });
    const productsWithoutThreshold = await ProductModel.countDocuments({
        lowStockThreshold: { $exists: false }
    });
    const productsWithoutColors = await ProductModel.countDocuments({
        $or: [
            { availableColors: { $exists: false } },
            { availableColors: null }
        ]
    });
    const ordersWithoutStockDeducted = await OrderModel.countDocuments({
        $or: [
            { stockDeducted: { $exists: false } },
            { stockDeducted: null }
        ]
    });

    const status = {
        productsWithoutStockQuantity,
        productsWithoutThreshold,
        productsWithoutColors,
        ordersWithoutStockDeducted,
        isMigrationNeeded:
            productsWithoutStockQuantity > 0 ||
            productsWithoutThreshold > 0 ||
            productsWithoutColors > 0 ||
            ordersWithoutStockDeducted > 0
    };

    logger.log?.(`[Migration Status] Pending products without stockQuantity: ${productsWithoutStockQuantity}`);
    logger.log?.(`[Migration Status] Pending products without lowStockThreshold: ${productsWithoutThreshold}`);
    logger.log?.(`[Migration Status] Pending products without availableColors: ${productsWithoutColors}`);
    logger.log?.(`[Migration Status] Pending orders without stockDeducted: ${ordersWithoutStockDeducted}`);

    return status;
}

/**
 * Migrates Product documents to initialize stock management schema fields.
 * Idempotent: Only updates documents where fields are missing.
 * Preserves all existing inStock values and recorded stock quantities.
 */
export async function runProductStockMigration({
    ProductModel = Product,
    dryRun = true,
    logger = console
} = {}) {
    logger.log?.(`[Product Migration] Starting (dryRun: ${dryRun})...`);

    const missingStockQtyCount = await ProductModel.countDocuments({
        stockQuantity: { $exists: false }
    });
    const missingThresholdCount = await ProductModel.countDocuments({
        lowStockThreshold: { $exists: false }
    });
    const missingColorsCount = await ProductModel.countDocuments({
        $or: [
            { availableColors: { $exists: false } },
            { availableColors: null }
        ]
    });

    if (dryRun) {
        logger.log?.(`[Product Migration - DRY RUN] Would initialize stockQuantity=null for ${missingStockQtyCount} products.`);
        logger.log?.(`[Product Migration - DRY RUN] Would initialize lowStockThreshold=5 for ${missingThresholdCount} products.`);
        logger.log?.(`[Product Migration - DRY RUN] Would initialize availableColors=[] for ${missingColorsCount} products.`);
        return {
            dryRun: true,
            productsMatchedStockQty: missingStockQtyCount,
            productsUpdatedStockQty: 0,
            productsMatchedThreshold: missingThresholdCount,
            productsUpdatedThreshold: 0,
            productsMatchedColors: missingColorsCount,
            productsUpdatedColors: 0
        };
    }

    // Step 1: Initialize missing stockQuantity to null (unrecorded stock, never invent numbers)
    const stockQtyResult = await ProductModel.updateMany(
        { stockQuantity: { $exists: false } },
        { $set: { stockQuantity: null } }
    );

    // Step 2: Initialize missing lowStockThreshold to default 5
    const thresholdResult = await ProductModel.updateMany(
        { lowStockThreshold: { $exists: false } },
        { $set: { lowStockThreshold: 5 } }
    );

    // Step 3: Initialize missing availableColors to empty array []
    const colorsResult = await ProductModel.updateMany(
        {
            $or: [
                { availableColors: { $exists: false } },
                { availableColors: null }
            ]
        },
        { $set: { availableColors: [] } }
    );

    const result = {
        dryRun: false,
        productsMatchedStockQty: stockQtyResult.matchedCount ?? stockQtyResult.n ?? 0,
        productsUpdatedStockQty: stockQtyResult.modifiedCount ?? stockQtyResult.nModified ?? 0,
        productsMatchedThreshold: thresholdResult.matchedCount ?? thresholdResult.n ?? 0,
        productsUpdatedThreshold: thresholdResult.modifiedCount ?? thresholdResult.nModified ?? 0,
        productsMatchedColors: colorsResult.matchedCount ?? colorsResult.n ?? 0,
        productsUpdatedColors: colorsResult.modifiedCount ?? colorsResult.nModified ?? 0
    };

    logger.log?.(`[Product Migration] Updated stockQuantity on ${result.productsUpdatedStockQty} products.`);
    logger.log?.(`[Product Migration] Updated lowStockThreshold on ${result.productsUpdatedThreshold} products.`);
    logger.log?.(`[Product Migration] Updated availableColors on ${result.productsUpdatedColors} products.`);

    return result;
}

/**
 * Migrates Order documents to initialize stockDeducted: false on legacy orders.
 * Idempotent: Only updates orders where stockDeducted does not exist or is null.
 */
export async function runOrderStockMigration({
    OrderModel = Order,
    dryRun = true,
    logger = console
} = {}) {
    logger.log?.(`[Order Migration] Starting (dryRun: ${dryRun})...`);

    const missingStockDeductedCount = await OrderModel.countDocuments({
        $or: [
            { stockDeducted: { $exists: false } },
            { stockDeducted: null }
        ]
    });

    if (dryRun) {
        logger.log?.(`[Order Migration - DRY RUN] Would initialize stockDeducted=false for ${missingStockDeductedCount} orders.`);
        return {
            dryRun: true,
            ordersMatchedStockDeducted: missingStockDeductedCount,
            ordersUpdatedStockDeducted: 0
        };
    }

    const orderResult = await OrderModel.updateMany(
        {
            $or: [
                { stockDeducted: { $exists: false } },
                { stockDeducted: null }
            ]
        },
        { $set: { stockDeducted: false } }
    );

    const result = {
        dryRun: false,
        ordersMatchedStockDeducted: orderResult.matchedCount ?? orderResult.n ?? 0,
        ordersUpdatedStockDeducted: orderResult.modifiedCount ?? orderResult.nModified ?? 0
    };

    logger.log?.(`[Order Migration] Updated stockDeducted on ${result.ordersUpdatedStockDeducted} orders.`);

    return result;
}

/**
 * Executes the full Phase 7 stock schema migration.
 */
export async function runFullMigration({
    ProductModel = Product,
    OrderModel = Order,
    dryRun = true,
    logger = console
} = {}) {
    logger.log?.(`=== GreenCart Phase 7 Stock Migration (dryRun: ${dryRun}) ===`);

    const initialStatus = await checkMigrationStatus({ ProductModel, OrderModel, logger });
    const productResults = await runProductStockMigration({ ProductModel, dryRun, logger });
    const orderResults = await runOrderStockMigration({ OrderModel, dryRun, logger });

    let finalStatus = initialStatus;
    if (!dryRun) {
        finalStatus = await checkMigrationStatus({ ProductModel, OrderModel, logger });
    }

    const summary = {
        dryRun,
        initialStatus,
        productResults,
        orderResults,
        finalStatus,
        completedAt: new Date().toISOString()
    };

    logger.log?.(`=== Migration Summary Completed ===`);
    return summary;
}

// Standalone CLI execution
const currentFilePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (invokedPath === currentFilePath) {
    const isExecute = process.argv.includes('--execute');
    const dryRun = !isExecute;

    (async () => {
        try {
            if (dryRun) {
                console.log('\n[NOTICE] Running in DRY-RUN mode. No changes will be written to the database.');
                console.log('To apply changes on live database, separate user approval is required along with --execute flag.\n');
            } else {
                console.log('\n[WARNING] EXECUTE mode enabled. Applying schema migrations to database...\n');
            }

            if (!process.env.MONGODB_URI) {
                console.error('[Error] MONGODB_URI environment variable is missing.');
                process.exit(1);
            }

            await mongoose.connect(process.env.MONGODB_URI, { dbName: "greencart" });
            console.log('[Database] Connected successfully.');

            const result = await runFullMigration({ dryRun });
            console.log('\nMigration execution finished:');
            console.dir(result, { depth: null });

            await mongoose.disconnect();
            console.log('[Database] Disconnected.');
            process.exit(0);
        } catch (error) {
            console.error('[Fatal Error] Migration failed:', error);
            try {
                await mongoose.disconnect();
            } catch {
                // ignore
            }
            process.exit(1);
        }
    })();
}
