/**
 * GreenCart Email Adapter
 * Supports Brevo Transactional Email REST API via native fetch.
 * Defaults to in-memory mock delivery in development and test environments.
 */

// In-memory message store for development and offline testing
const _mockSentEmails = [];
let _mockDeliveryFailure = false;

const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB per attachment

/**
 * Validates and normalizes email attachments into base64 format.
 *
 * @param {Array<Object>} attachments
 * @returns {Array<{ name: string, content: string, contentType: string, size: number }>}
 */
function validateAndFormatAttachments(attachments) {
    if (attachments === undefined) {
        return [];
    }

    if (!Array.isArray(attachments)) {
        throw new Error("Invalid attachments: attachments must be an array");
    }

    if (attachments.length === 0) {
        return [];
    }

    return attachments.map((att, index) => {
        if (!att || typeof att !== 'object' || Array.isArray(att)) {
            throw new Error(`Invalid attachment at index ${index}: attachment must be an object`);
        }

        const rawName = att.name;
        if (!rawName || typeof rawName !== 'string' || !rawName.trim()) {
            throw new Error(`Invalid attachment at index ${index}: attachment must have a non-empty name`);
        }
        const name = rawName.trim();

        // Enforce safe filename: no path separators or directory traversal
        if (name.includes('/') || name.includes('\\') || name.includes('..')) {
            throw new Error(`Invalid attachment name '${name}': filename must not contain path separators or directory traversal characters`);
        }

        let base64Content = '';
        let byteLength = 0;
        const isPdf = name.toLowerCase().endsWith('.pdf');

        // Caller can provide Buffer in `content` or `buffer`
        const candidateBuffer = Buffer.isBuffer(att.content) ? att.content : (Buffer.isBuffer(att.buffer) ? att.buffer : null);

        if (candidateBuffer) {
            byteLength = candidateBuffer.length;
            if (byteLength === 0) {
                throw new Error(`Invalid attachment '${name}': attachment buffer cannot be empty`);
            }
            if (byteLength > MAX_ATTACHMENT_SIZE_BYTES) {
                throw new Error(`Attachment '${name}' exceeds maximum allowed size of 5 MB (${byteLength} bytes)`);
            }
            if (isPdf) {
                const header = candidateBuffer.subarray(0, 5).toString('ascii');
                if (header !== '%PDF-') {
                    throw new Error(`Invalid PDF attachment '${name}': buffer does not begin with standard %PDF- signature`);
                }
            }
            base64Content = candidateBuffer.toString('base64');
        } else if (typeof att.content === 'string' && att.content.trim().length > 0) {
            const trimmed = att.content.trim();
            const base64Regex = /^[A-Za-z0-9+/=]+$/;
            if (!base64Regex.test(trimmed) || (trimmed.length % 4 !== 0)) {
                throw new Error(`Invalid attachment '${name}': content is not a valid base64-encoded string`);
            }
            const decoded = Buffer.from(trimmed, 'base64');
            byteLength = decoded.length;
            if (byteLength === 0) {
                throw new Error(`Invalid attachment '${name}': decoded attachment content is empty`);
            }
            if (byteLength > MAX_ATTACHMENT_SIZE_BYTES) {
                throw new Error(`Attachment '${name}' exceeds maximum allowed size of 5 MB (${byteLength} bytes)`);
            }
            if (isPdf) {
                const header = decoded.subarray(0, 5).toString('ascii');
                if (header !== '%PDF-') {
                    throw new Error(`Invalid PDF attachment '${name}': content does not begin with standard %PDF- signature`);
                }
            }
            base64Content = trimmed;
        } else {
            throw new Error(`Invalid attachment '${name}': content must be a non-empty Buffer or base64 string`);
        }

        const contentType = (typeof att.contentType === 'string' && att.contentType.trim())
            ? att.contentType.trim()
            : (isPdf ? 'application/pdf' : 'application/octet-stream');

        return {
            name,
            content: base64Content,
            contentType,
            size: byteLength
        };
    });
}

/**
 * Sends a transactional email using the configured provider.
 * 
 * @param {Object} options
 * @param {string} options.toEmail Recipient email address
 * @param {string} options.subject Email subject line
 * @param {string} options.htmlContent HTML email content
 * @param {string} [options.textContent] Plaintext fallback content
 * @param {string} [options.code] Raw verification code (for mock testing only)
 * @param {Array<Object>} [options.attachments=[]] Optional array of attachment objects
 * @returns {Promise<{ success: boolean, messageId?: string }>}
 */
export async function sendEmail({ toEmail, subject, htmlContent, textContent, code, attachments = [] }) {
    if (!toEmail || typeof toEmail !== 'string') {
        throw new Error("Recipient email address is required");
    }

    const formattedAttachments = validateAndFormatAttachments(attachments);

    const provider = (process.env.EMAIL_PROVIDER || 'mock').toLowerCase().trim();
    const isProduction = process.env.NODE_ENV === 'production';

    // Strict security check: mock provider is strictly forbidden in production
    if (isProduction && provider === 'mock') {
        throw new Error("Mock email delivery is strictly forbidden in production. Please configure EMAIL_PROVIDER=brevo and set BREVO_API_KEY.");
    }

    if (provider === 'brevo') {
        const apiKey = process.env.BREVO_API_KEY;
        const fromEmail = process.env.EMAIL_FROM;

        if (!apiKey || !apiKey.trim() || !fromEmail || !fromEmail.trim()) {
            throw new Error("Email service misconfigured: missing BREVO_API_KEY or EMAIL_FROM");
        }

        const endpoint = 'https://api.brevo.com/v3/smtp/email';
        const payload = {
            sender: {
                name: "GreenCart",
                email: fromEmail.trim()
            },
            to: [
                { email: toEmail.trim() }
            ],
            subject: subject || "GreenCart Checkout Verification",
            htmlContent: htmlContent || `<p>Your verification code is <strong>${code}</strong>.</p>`,
            ...(textContent ? { textContent } : {}),
            ...(formattedAttachments.length > 0
                ? {
                    attachment: formattedAttachments.map((att) => ({
                        name: att.name,
                        content: att.content
                    }))
                }
                : {})
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey.trim(),
                'content-type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let errorDetail = response.statusText;
            try {
                const errJson = await response.json();
                if (errJson && errJson.message) {
                    errorDetail = errJson.message;
                }
            } catch {
                // Keep statusText if response is not JSON
            }
            throw new Error(`Brevo API error (${response.status}): ${errorDetail}`);
        }

        const data = await response.json();
        return {
            success: true,
            messageId: data?.messageId || 'brevo-sent'
        };
    }

    if (provider === 'mock') {
        if (_mockDeliveryFailure) {
            throw new Error("Simulated mock email delivery failure");
        }

        const record = {
            to: toEmail.trim(),
            subject,
            htmlContent,
            textContent,
            code,
            attachments: formattedAttachments.map((att) => ({
                name: att.name,
                contentType: att.contentType,
                content: att.content,
                size: att.size
            })),
            sentAt: new Date()
        };

        _mockSentEmails.push(record);

        return {
            success: true,
            messageId: `mock-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
        };
    }

    throw new Error(`Unsupported email provider: ${provider}`);
}

// -----------------------------------------------------------------------------
// Test-only harness hooks (accessible only in non-production)
// -----------------------------------------------------------------------------

export function __getMockSentEmails() {
    if (process.env.NODE_ENV === 'production') {
        throw new Error("Test hooks are disabled in production");
    }
    return [..._mockSentEmails];
}

export function __clearMockSentEmails() {
    if (process.env.NODE_ENV === 'production') {
        throw new Error("Test hooks are disabled in production");
    }
    _mockSentEmails.length = 0;
    _mockDeliveryFailure = false;
}

export function __setMockDeliveryFailure(shouldFail) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error("Test hooks are disabled in production");
    }
    _mockDeliveryFailure = Boolean(shouldFail);
}
