import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateInvoicePdf, sanitizeText, containsBengali } from '../services/invoicePdfService.js';

/**
 * Extracts rendered text from an uncompressed PDFKit Buffer.
 * Supports both standard WinAnsi 1-byte fonts and TrueType subset fonts with ToUnicode CMap.
 *
 * @param {Buffer} pdfBuffer
 * @returns {string}
 */
function extractPdfText(pdfBuffer) {
    const raw = pdfBuffer.toString('binary');
    const cmap = new Map();

    // 1. Parse ToUnicode bfrange
    for (const rangeMatch of raw.matchAll(/<([0-9a-fA-F]{4})>\s+<([0-9a-fA-F]{4})>\s+\[([\s\S]*?)\]/g)) {
        const startGid = parseInt(rangeMatch[1], 16);
        const elements = rangeMatch[3].match(/<([0-9a-fA-F\s]+)>/g) || [];
        elements.forEach((el, idx) => {
            const hexParts = el.replace(/[<>]/g, '').trim().split(/\s+/);
            let unicodeStr = '';
            for (const part of hexParts) {
                if (part.length === 4) {
                    const code = parseInt(part, 16);
                    if (code > 0) unicodeStr += String.fromCodePoint(code);
                }
            }
            if (unicodeStr) {
                const gid = (startGid + idx).toString(16).padStart(4, '0').toLowerCase();
                cmap.set(gid, unicodeStr);
            }
        });
    }

    // 2. Parse ToUnicode bfchar
    for (const charMatch of raw.matchAll(/<([0-9a-fA-F]{4})>\s+<([0-9a-fA-F\s]+)>/g)) {
        const gid = charMatch[1].toLowerCase();
        const hexParts = charMatch[2].trim().split(/\s+/);
        let unicodeStr = '';
        for (const part of hexParts) {
            if (part.length === 4) {
                const code = parseInt(part, 16);
                if (code > 0) unicodeStr += String.fromCodePoint(code);
            }
        }
        if (unicodeStr) cmap.set(gid, unicodeStr);
    }

    const textRuns = [];

    // 3. Extract text from TJ arrays: [(...)] TJ or [<...>] TJ
    for (const match of raw.matchAll(/\[(.*?)\]\s*TJ/gs)) {
        const tjContent = match[1];
        let runStr = '';
        for (const hexMatch of tjContent.matchAll(/<([0-9a-fA-F]+)>/g)) {
            const hexStr = hexMatch[1];
            if (hexStr.length % 4 === 0 && cmap.size > 0) {
                for (let i = 0; i < hexStr.length; i += 4) {
                    const gid = hexStr.slice(i, i + 4).toLowerCase();
                    if (cmap.has(gid)) {
                        runStr += cmap.get(gid);
                    } else {
                        try { runStr += Buffer.from(hexStr.slice(i, i + 4), 'hex').toString('utf8'); } catch {}
                    }
                }
            } else {
                try { runStr += Buffer.from(hexStr, 'hex').toString('utf8'); } catch {}
            }
        }
        if (runStr) textRuns.push(runStr);
    }

    // 4. Extract text from standalone Tj operators
    for (const match of raw.matchAll(/\((.*?)\)\s*Tj/g)) {
        textRuns.push(match[1]);
    }

    // Fallback: If no TJ/Tj matched, decode all raw hex runs as utf8
    if (textRuns.length === 0) {
        for (const match of raw.matchAll(/<([0-9a-fA-F]+)>/g)) {
            try {
                textRuns.push(Buffer.from(match[1], 'hex').toString('utf8'));
            } catch {}
        }
    }

    return textRuns.join(' ');
}

describe('GreenCart Backend Invoice PDF Generation Security Suite (Batch 1)', () => {

    // -------------------------------------------------------------------------
    // 1. Signature & Buffer Verification
    // -------------------------------------------------------------------------
    it('returns a Node.js Buffer beginning with the valid PDF signature (%PDF-)', async () => {
        const order = {
            _id: '507f1f77bcf86cd799439011',
            orderNumber: 'GC-K7M2Q9',
            amount: 102,
            createdAt: new Date('2026-10-30T10:00:00Z'),
            items: [
                { name: 'Organic Milk 1L', unitPrice: 100, quantity: 1 }
            ]
        };

        const pdfBuffer = await generateInvoicePdf(order);

        assert.ok(Buffer.isBuffer(pdfBuffer), 'Output must be an instance of Buffer');
        assert.ok(pdfBuffer.length > 500, 'PDF buffer must contain binary document content');
        const signature = pdfBuffer.subarray(0, 5).toString('ascii');
        assert.equal(signature, '%PDF-', 'Buffer header must match the standard %PDF- magic signature');
    });

    // -------------------------------------------------------------------------
    // 2. Modern Order with Historical Snapshots
    // -------------------------------------------------------------------------
    it('generates a complete PDF using historical item name and unitPrice snapshots', async () => {
        const order = {
            _id: '507f1f77bcf86cd799439012',
            orderNumber: 'GC-SNAP01',
            amount: 153, // 150 subtotal + 3 tax (2%)
            createdAt: new Date('2026-10-30T10:00:00Z'),
            paymentType: 'COD',
            isPaid: false,
            status: 'Order Placed',
            address: {
                firstName: 'Rahim',
                lastName: 'Uddin',
                street: 'House 12, Road 4',
                city: 'Dhaka',
                state: 'Dhaka',
                zipcode: 1212,
                country: 'Bangladesh',
                phone: '+8801700000000'
            },
            items: [
                {
                    product: '507f1f77bcf86cd799439040',
                    name: 'Historical Basmati Rice 5kg',
                    unitPrice: 100,
                    quantity: 1
                },
                {
                    product: '507f1f77bcf86cd799439041',
                    name: 'Historical Mustard Oil 1L',
                    unitPrice: 50,
                    quantity: 1
                }
            ]
        };

        const pdfBuffer = await generateInvoicePdf(order, { compress: false });
        const pdfText = extractPdfText(pdfBuffer);

        assert.ok(pdfText.includes('GreenCart'), 'Must render GreenCart branding');
        assert.ok(pdfText.includes('TAX INVOICE'), 'Must render TAX INVOICE title');
        assert.ok(pdfText.includes('GC-SNAP01'), 'Must render order number');
        assert.ok(pdfText.includes('Rahim Uddin'), 'Must render customer full name');
        assert.ok(pdfText.includes('House 12, Road 4'), 'Must render street address');
        assert.ok(pdfText.includes('+8801700000000'), 'Must render customer phone');
        assert.ok(pdfText.includes('Historical Basmati Rice 5kg'), 'Must render historical item 1 snapshot name');
        assert.ok(pdfText.includes('Historical Mustard Oil 1L'), 'Must render historical item 2 snapshot name');
        assert.ok(pdfText.includes('Items Subtotal:'), 'Must render subtotal breakdown for complete snapshots');
        assert.ok(pdfText.includes('Tax (2%):'), 'Must render 2% tax breakdown');
        assert.ok(pdfText.includes('Total Amount:'), 'Must render total amount label');
    });

    // -------------------------------------------------------------------------
    // 3. Current Catalog Price is NEVER Substituted
    // -------------------------------------------------------------------------
    it('strictly uses snapshot unitPrice and never substitutes current catalog price', async () => {
        const order = {
            _id: '507f1f77bcf86cd799439013',
            orderNumber: 'GC-PRICE01',
            amount: 51, // 50 + 1 (2% tax)
            items: [
                {
                    // Item snapshot recorded at 50 BDT at checkout
                    name: 'Frozen Green Peas 500g',
                    unitPrice: 50,
                    quantity: 1,
                    // Current catalog object attached via populate has inflated price
                    product: {
                        _id: '507f1f77bcf86cd799439042',
                        name: 'Frozen Green Peas 500g (Inflated)',
                        offerPrice: 199,
                        regularPrice: 250
                    }
                }
            ]
        };

        const pdfBuffer = await generateInvoicePdf(order, { compress: false });
        const pdfText = extractPdfText(pdfBuffer);

        assert.ok(pdfText.includes('50'), 'Must contain historical snapshot unit price (50)');
        assert.ok(!pdfText.includes('199'), 'Must NOT substitute catalog offerPrice (199)');
        assert.ok(!pdfText.includes('250'), 'Must NOT substitute catalog regularPrice (250)');
    });

    // -------------------------------------------------------------------------
    // 4. Legacy Orders Lacking Snapshot Data
    // -------------------------------------------------------------------------
    it('renders N/A* and legacy notice footnote for orders missing unitPrice snapshots', async () => {
        const legacyOrder = {
            _id: '507f1f77bcf86cd799439014',
            orderNumber: 'GC-LEGACY01',
            amount: 500, // Authoritative final total charged
            createdAt: new Date('2025-01-15T12:00:00Z'),
            items: [
                {
                    product: {
                        _id: '507f1f77bcf86cd799439043',
                        name: 'Legacy Wheat Flour 10kg',
                        offerPrice: 480
                    },
                    // unitPrice snapshot is missing on legacy orders
                    quantity: 1
                }
            ]
        };

        const pdfBuffer = await generateInvoicePdf(legacyOrder, { compress: false });
        const pdfText = extractPdfText(pdfBuffer);

        assert.ok(pdfText.includes('N/A*'), 'Must display N/A* when unitPrice is missing');
        assert.ok(pdfText.includes('Notice Regarding Historical Item Prices'), 'Must render legacy order warning notice');
        assert.ok(pdfText.includes('Current store catalog prices are never substituted'), 'Must include non-substitution disclaimer');
        assert.ok(!pdfText.includes('480'), 'Must NOT substitute catalog price (480) for missing historical price');
        assert.ok(!pdfText.includes('Items Subtotal:'), 'Must NOT calculate unverified subtotal for legacy order');
        assert.ok(!pdfText.includes('Tax (2%):'), 'Must NOT calculate unverified tax breakdown for legacy order');
        assert.ok(pdfText.includes('500'), 'Must display authoritative final order.amount (500)');
    });

    // -------------------------------------------------------------------------
    // 5. Handling Missing Fallback Names
    // -------------------------------------------------------------------------
    it('provides clear fallback description when neither snapshot name nor populated product exists', async () => {
        const order = {
            _id: '507f1f77bcf86cd799439015',
            orderNumber: 'GC-NONAME',
            amount: 100,
            items: [
                {
                    product: '507f1f77bcf86cd799439099',
                    unitPrice: 100,
                    quantity: 1
                }
            ]
        };

        const pdfBuffer = await generateInvoicePdf(order, { compress: false });
        const pdfText = extractPdfText(pdfBuffer);

        assert.ok(pdfText.includes('Product record') || pdfText.includes('Ordered Item'), 'Must display safe fallback description');
    });

    // -------------------------------------------------------------------------
    // 6. Safe Handling of Invalid or Missing Amount
    // -------------------------------------------------------------------------
    it('handles invalid or missing order.amount gracefully without crashing', async () => {
        const order = {
            _id: '507f1f77bcf86cd799439016',
            orderNumber: 'GC-NOAMOUNT',
            amount: null,
            items: [{ name: 'Test Item', unitPrice: 50, quantity: 1 }]
        };

        const pdfBuffer = await generateInvoicePdf(order, { compress: false });
        assert.ok(Buffer.isBuffer(pdfBuffer));
        const pdfText = extractPdfText(pdfBuffer);
        assert.ok(pdfText.includes('N/A'), 'Must display N/A when order.amount is not a valid number');
    });

    // -------------------------------------------------------------------------
    // 7. Multi-Item Integrity & Never Omits Products
    // -------------------------------------------------------------------------
    it('renders all products without silently omitting any order items', async () => {
        const items = [
            { name: 'Product Alpha 100g', unitPrice: 10, quantity: 1 },
            { name: 'Product Beta 200g', unitPrice: 20, quantity: 2 },
            { name: 'Product Gamma 300g', unitPrice: 30, quantity: 1 },
            { name: 'Product Delta 400g', unitPrice: 40, quantity: 3 }
        ];

        const subtotal = 10*1 + 20*2 + 30*1 + 40*3; // 200
        const tax = Math.floor(subtotal * 0.02); // 4
        const total = subtotal + tax; // 204

        const order = {
            _id: '507f1f77bcf86cd799439017',
            orderNumber: 'GC-ALLITEMS',
            amount: total,
            items
        };

        const pdfBuffer = await generateInvoicePdf(order, { compress: false });
        const pdfText = extractPdfText(pdfBuffer);

        assert.ok(pdfText.includes('Product Alpha 100g'), 'Must include Product Alpha');
        assert.ok(pdfText.includes('Product Beta 200g'), 'Must include Product Beta');
        assert.ok(pdfText.includes('Product Gamma 300g'), 'Must include Product Gamma');
        assert.ok(pdfText.includes('Product Delta 400g'), 'Must include Product Delta');
    });

    // -------------------------------------------------------------------------
    // 8. Multi-Page Support for Large Orders
    // -------------------------------------------------------------------------
    it('automatically generates multi-page A4 output for large orders without clipping', async () => {
        const largeItems = Array.from({ length: 45 }, (_, i) => ({
            name: `Grocery Pantry Item #${i + 1}`,
            unitPrice: 25,
            quantity: 1
        }));

        const subtotal = 45 * 25; // 1125
        const tax = Math.floor(subtotal * 0.02); // 22
        const total = subtotal + tax; // 1147

        const largeOrder = {
            _id: '507f1f77bcf86cd799439018',
            orderNumber: 'GC-LARGE45',
            amount: total,
            items: largeItems
        };

        const pdfBuffer = await generateInvoicePdf(largeOrder);
        const raw = pdfBuffer.toString('binary');
        const pageMatches = raw.match(/\/Type\s*\/Page(?=[\s\/])/g) || [];

        assert.ok(pageMatches.length >= 2, `Large order of 45 items must span at least 2 pages (actual: ${pageMatches.length})`);
    });

    // -------------------------------------------------------------------------
    // 9. Standard Order Fits on Exactly One Page
    // -------------------------------------------------------------------------
    it('keeps standard small grocery orders on exactly 1 A4 page', async () => {
        const normalItems = [
            { name: 'Fresh Bananas (1 Dozen)', unitPrice: 60, quantity: 1 },
            { name: 'Farm Eggs (Pack of 12)', unitPrice: 140, quantity: 1 }
        ];

        const subtotal = 200;
        const tax = 4;

        const normalOrder = {
            _id: '507f1f77bcf86cd799439019',
            orderNumber: 'GC-ONEPAGE',
            amount: subtotal + tax,
            items: normalItems
        };

        const pdfBuffer = await generateInvoicePdf(normalOrder);
        const raw = pdfBuffer.toString('binary');
        const pageMatches = raw.match(/\/Type\s*\/Page(?=[\s\/])/g) || [];

        assert.equal(pageMatches.length, 1, 'Standard 2-item grocery order must fit on exactly 1 page');
    });

    // -------------------------------------------------------------------------
    // 10. Information Disclosure Prevention (Zero Sensitive Data in PDF)
    // -------------------------------------------------------------------------
    it('never renders password hashes, OTPs, verification tokens, or moderation notes', async () => {
        const sensitiveOrder = {
            _id: '507f1f77bcf86cd799439020',
            orderNumber: 'GC-SAFE01',
            amount: 102,
            items: [{ name: 'Safe Green Tea', unitPrice: 100, quantity: 1 }],
            // Injected sensitive fields that might accidentally be present on order or address object
            password: 'secret_bcrypt_hash_$2a$10$abcdefghijklmnopqrstuvwxyz',
            otpCode: '849201',
            verificationToken: 'token_secret_hex_value_1234567890',
            verificationTokenHash: 'hash_secret_value_abcdef123456',
            moderationNote: 'Internal seller notes: user disputed previous order',
            moderatedBy: 'admin_private_identifier',
            databaseConnectionString: 'mongodb://admin:secretPass@localhost:27017'
        };

        const pdfBuffer = await generateInvoicePdf(sensitiveOrder, { compress: false });
        const rawPdfString = pdfBuffer.toString('binary');
        const pdfText = extractPdfText(pdfBuffer);

        assert.ok(!pdfText.includes('secret_bcrypt_hash'), 'Must NOT leak password hash');
        assert.ok(!pdfText.includes('849201'), 'Must NOT leak OTP code');
        assert.ok(!pdfText.includes('token_secret_hex'), 'Must NOT leak verification token');
        assert.ok(!pdfText.includes('hash_secret_value'), 'Must NOT leak token hash');
        assert.ok(!pdfText.includes('Internal seller notes'), 'Must NOT leak internal moderation notes');
        assert.ok(!pdfText.includes('admin_private_identifier'), 'Must NOT leak internal admin identifier');
        assert.ok(!pdfText.includes('mongodb://admin'), 'Must NOT leak database connection strings');

        // Also assert raw binary does not contain these strings
        assert.ok(!rawPdfString.includes('secret_bcrypt_hash'));
        assert.ok(!rawPdfString.includes('mongodb://admin'));
    });

    // -------------------------------------------------------------------------
    // 11. Missing Address & Customer Fields Resilience
    // -------------------------------------------------------------------------
    it('handles missing optional customer and address fields without throwing errors', async () => {
        const minimalOrder = {
            _id: '507f1f77bcf86cd799439021',
            orderNumber: 'GC-MINIMAL',
            amount: 51,
            // Address object is completely omitted
            items: [{ name: 'Minimal Item', unitPrice: 50, quantity: 1 }]
        };

        const pdfBuffer = await generateInvoicePdf(minimalOrder);
        assert.ok(Buffer.isBuffer(pdfBuffer));
        assert.ok(pdfBuffer.length > 500);
    });

    // -------------------------------------------------------------------------
    // 12. Input Validation (Rejects Non-Object or Null Order)
    // -------------------------------------------------------------------------
    it('rejects null, undefined, or primitive order argument with informative error', async () => {
        await assert.rejects(
            async () => await generateInvoicePdf(null),
            /Invalid order data/
        );

        await assert.rejects(
            async () => await generateInvoicePdf(undefined),
            /Invalid order data/
        );

        await assert.rejects(
            async () => await generateInvoicePdf('string-not-order'),
            /Invalid order data/
        );

        await assert.rejects(
            async () => await generateInvoicePdf([1, 2, 3]),
            /Invalid order data/
        );
    });

    // -------------------------------------------------------------------------
    // 13. String Sanitizer Unit Test
    // -------------------------------------------------------------------------
    it('sanitizeText replaces Taka symbol with BDT and strips unprintable control chars', () => {
        assert.equal(sanitizeText('৳500'), 'BDT 500');
        assert.equal(sanitizeText('Test\x00\x08Item\x1F'), 'TestItem');
        assert.equal(sanitizeText(null, 'Fallback'), 'Fallback');
        assert.equal(sanitizeText(undefined, 'Fallback'), 'Fallback');
        assert.equal(sanitizeText('', 'Fallback'), 'Fallback');
    });

    // -------------------------------------------------------------------------
    // 14. Bengali Unicode Detection Unit Test (containsBengali)
    // -------------------------------------------------------------------------
    it('containsBengali accurately identifies Bengali Unicode characters', () => {
        assert.equal(containsBengali('Organic Cow Milk 1L'), false, 'Pure English should return false');
        assert.equal(containsBengali('খাঁটি গাওয়া ঘি ৫০০ গ্রাম'), true, 'Pure Bengali should return true');
        assert.equal(containsBengali('Fortune বাসমতী Rice 5kg'), true, 'Mixed English and Bengali should return true');
        assert.equal(containsBengali('স্পেশাল ঘি, স্বাস্থ্যকর খাবার, মিষ্টান্ন'), true, 'Bengali conjuncts should return true');
        assert.equal(containsBengali('গ্রিনকার্ট প্রিমিয়াম চা'), true, 'Bengali reph/fola should return true');
        assert.equal(containsBengali('BDT 1500'), false, 'ASCII currency should return false');
        assert.equal(containsBengali(''), false, 'Empty string should return false');
        assert.equal(containsBengali(null), false, 'Null should return false');
        assert.equal(containsBengali(undefined), false, 'Undefined should return false');
        assert.equal(containsBengali(12345), false, 'Non-string primitive should return false');
    });

    // -------------------------------------------------------------------------
    // 15. Pure Bengali Product Name Rendering (Nikosh Font)
    // -------------------------------------------------------------------------
    it('renders pure Bengali product names and embeds Bengali Unicode in PDF without error', async () => {
        const order = {
            _id: '507f1f77bcf86cd799439030',
            orderNumber: 'GC-BENGALI-01',
            amount: 510,
            createdAt: new Date('2026-10-30T10:00:00Z'),
            paymentType: 'COD',
            isPaid: false,
            items: [
                {
                    name: 'খাঁটি গাওয়া ঘি ৫০০ গ্রাম',
                    unitPrice: 500,
                    quantity: 1
                }
            ]
        };

        const pdfBuffer = await generateInvoicePdf(order, { compress: false });
        assert.ok(Buffer.isBuffer(pdfBuffer));
        assert.equal(pdfBuffer.subarray(0, 5).toString('ascii'), '%PDF-');

        const pdfText = extractPdfText(pdfBuffer);
        assert.ok(pdfText.includes('GreenCart'), 'Must retain GreenCart English branding');
        assert.ok(pdfText.includes('TAX INVOICE'), 'Must retain English tax invoice header');
        assert.ok(pdfText.includes('GC-BENGALI-01'), 'Must retain order number');
        // Verify Bengali characters are embedded and extracted via CMap
        assert.ok(/[\u0980-\u09FF]/.test(pdfText), 'Extracted PDF text must contain Bengali Unicode characters');
        assert.ok(pdfText.includes('গাওয়া'), 'Extracted PDF text must contain গাওয়া');
        assert.ok(pdfText.includes('৫০০'), 'Extracted PDF text must contain Bengali numerals ৫০০');
    });

    // -------------------------------------------------------------------------
    // 16. Mixed English and Bengali Product Name Rendering
    // -------------------------------------------------------------------------
    it('renders mixed English and Bengali product names correctly', async () => {
        const order = {
            _id: '507f1f77bcf86cd799439031',
            orderNumber: 'GC-MIXED-01',
            amount: 102,
            createdAt: new Date('2026-10-30T10:00:00Z'),
            paymentType: 'COD',
            items: [
                {
                    name: 'Fortune বাসমতী Rice 5kg',
                    unitPrice: 100,
                    quantity: 1
                }
            ]
        };

        const pdfBuffer = await generateInvoicePdf(order, { compress: false });
        assert.ok(Buffer.isBuffer(pdfBuffer));

        const pdfText = extractPdfText(pdfBuffer);
        assert.ok(pdfText.includes('Fortune'), 'Must contain English prefix Fortune');
        assert.ok(pdfText.includes('বাসমতী'), 'Must contain Bengali word বাসমতী');
        assert.ok(pdfText.includes('Rice 5kg'), 'Must contain English suffix Rice 5kg');
        assert.ok(pdfText.includes('GC-MIXED-01'), 'Must contain order number');
    });

    // -------------------------------------------------------------------------
    // 17. Complex Bengali Conjuncts (যুক্তাক্ষর) Rendering
    // -------------------------------------------------------------------------
    it('renders complex Bengali conjuncts (যুক্তাক্ষর) without dropping characters', async () => {
        const order = {
            _id: '507f1f77bcf86cd799439032',
            orderNumber: 'GC-CONJUNCT-01',
            amount: 153,
            createdAt: new Date('2026-10-30T10:00:00Z'),
            items: [
                {
                    name: 'স্পেশাল ঘি, স্বাস্থ্যকর খাবার, মিষ্টান্ন',
                    unitPrice: 150,
                    quantity: 1
                }
            ]
        };

        const pdfBuffer = await generateInvoicePdf(order, { compress: false });
        assert.ok(Buffer.isBuffer(pdfBuffer));

        const pdfText = extractPdfText(pdfBuffer);
        // Verify Bengali text with conjuncts (স্প, স্থ, ষ্ট, ন্ন) renders and extracts
        assert.ok(/[\u0980-\u09FF]/.test(pdfText), 'Must contain Bengali Unicode characters');
        assert.ok(pdfText.includes('খাবার'), 'Must preserve Bengali base word খাবার');
        // Ensure PDFKit CIDFont ToUnicode mapping is populated
        const raw = pdfBuffer.toString('binary');
        assert.ok(raw.includes('/ToUnicode'), 'PDF stream must include TrueType ToUnicode CMap dictionary');
    });

    // -------------------------------------------------------------------------
    // 18. Bengali Reph and Fola (রেফ ও ফলা) Rendering
    // -------------------------------------------------------------------------
    it('renders Bengali reph and fola correctly in invoice items', async () => {
        const order = {
            _id: '507f1f77bcf86cd799439033',
            orderNumber: 'GC-FOLA-01',
            amount: 82,
            createdAt: new Date('2026-10-30T10:00:00Z'),
            items: [
                {
                    name: 'গ্রিনকার্ট প্রিমিয়াম চা',
                    unitPrice: 80,
                    quantity: 1
                }
            ]
        };

        const pdfBuffer = await generateInvoicePdf(order, { compress: false });
        assert.ok(Buffer.isBuffer(pdfBuffer));

        const pdfText = extractPdfText(pdfBuffer);
        assert.ok(/[\u0980-\u09FF]/.test(pdfText), 'Must contain Bengali Unicode characters');
        assert.ok(pdfText.includes('চা'), 'Must contain post-base word চা');
    });

    // -------------------------------------------------------------------------
    // 19. Bengali Customer Name and Delivery Address Rendering
    // -------------------------------------------------------------------------
    it('renders Bengali customer name and delivery address in Nikosh font', async () => {
        const order = {
            _id: '507f1f77bcf86cd799439034',
            orderNumber: 'GC-ADDR-BENGALI',
            amount: 306,
            createdAt: new Date('2026-10-30T10:00:00Z'),
            address: {
                firstName: 'রহিম',
                lastName: 'উদ্দিন',
                street: 'মিরপুর ১০, ব্লক সি',
                city: 'ঢাকা',
                state: 'ঢাকা',
                zipcode: 1216,
                country: 'Bangladesh',
                phone: '+8801712345678'
            },
            items: [
                {
                    name: 'Organic Cow Milk 1L',
                    unitPrice: 300,
                    quantity: 1
                }
            ]
        };

        const pdfBuffer = await generateInvoicePdf(order, { compress: false });
        assert.ok(Buffer.isBuffer(pdfBuffer));

        const pdfText = extractPdfText(pdfBuffer);
        // Verify customer details in Bengali
        assert.ok(/[\u0980-\u09FF]/.test(pdfText), 'Must contain Bengali text for customer details');
        assert.ok(pdfText.includes('ঢাকা'), 'Must contain city name ঢাকা');
        assert.ok(pdfText.includes('১০'), 'Must contain Bengali digits ১০');
        assert.ok(pdfText.includes('+8801712345678'), 'Must contain customer phone');
        // English product in the same order should still render in Helvetica
        assert.ok(pdfText.includes('Organic Cow Milk 1L'), 'Must render English product description');
    });
});
