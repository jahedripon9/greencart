import { verifyToken, createClerkClient } from '@clerk/backend';
import jwt from 'jsonwebtoken';

/**
 * Distinguishable error for missing or invalid server Clerk credentials.
 */
export class ClerkConfigurationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ClerkConfigurationError';
        this.isConfigurationError = true;
    }
}

// Injectable mock profile lookup strictly for automated test suites
let _mockUserLookup = null;

export function _setMockUserLookup(fn) {
    if (process.env.NODE_ENV !== 'test') {
        throw new Error("Mock user lookup is only available in test mode");
    }
    _mockUserLookup = fn;
}

export function _clearMockUserLookup() {
    _mockUserLookup = null;
}

/**
 * Validates and extracts verified identity claims from a Clerk Google session token.
 * 
 * Flow:
 * 1. Cryptographically verify the session token signature and timing claims.
 * 2. Extract the verified subject claim (clerkId).
 * 3. Authoritatively retrieve the user profile from Clerk Backend API.
 * 4. Resolve primary email, verification status, and name from trusted user object.
 * 
 * @param {string} token The client-provided Clerk session token
 * @returns {Promise<{ clerkId: string, email: string, emailVerified: boolean, name: string }>}
 */
export async function verifyClerkSessionToken(token) {
    if (!token || typeof token !== 'string' || !token.trim()) {
        throw new Error("Missing or invalid Clerk token");
    }

    const trimmedToken = token.trim();
    let payload = null;

    const secretKey = process.env.CLERK_SECRET_KEY;
    const jwtKey = process.env.CLERK_JWT_KEY;
    const testSecret = process.env.TEST_CLERK_SECRET;
    const isProduction = process.env.NODE_ENV === 'production';
    const isTest = process.env.NODE_ENV === 'test';

    // 1. Production Mode Guard: strictly forbid mock verification or missing credentials
    if (isProduction) {
        if (!secretKey || !secretKey.startsWith('sk_')) {
            throw new ClerkConfigurationError("Clerk authentication secret key (CLERK_SECRET_KEY) is required and must be properly configured");
        }
    }

    // 2. Cryptographic JWT Verification
    const verifyOptions = {};
    if (secretKey && secretKey.startsWith('sk_')) {
        verifyOptions.secretKey = secretKey;
    }
    if (jwtKey) {
        verifyOptions.jwtKey = jwtKey;
    }
    if (process.env.CLERK_ISSUER) {
        verifyOptions.issuer = process.env.CLERK_ISSUER;
    }
    if (process.env.CLERK_AUTHORIZED_PARTIES) {
        verifyOptions.authorizedParties = process.env.CLERK_AUTHORIZED_PARTIES
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
    }

    if (verifyOptions.secretKey || verifyOptions.jwtKey) {
        try {
            payload = await verifyToken(trimmedToken, verifyOptions);
        } catch (err) {
            throw new Error(`Token verification failed: ${err.message || 'Invalid or expired signature'}`);
        }
    } else if (isTest) {
        // Mock verification is strictly permitted ONLY in test mode
        try {
            payload = jwt.verify(trimmedToken, testSecret || 'test_clerk_secret_mock_32_characters_key');
        } catch (jwtErr) {
            throw new Error(`Token verification failed: ${jwtErr.message}`);
        }
    } else {
        throw new ClerkConfigurationError("Clerk authentication credentials are not configured on the server");
    }

    if (!payload || typeof payload !== 'object') {
        throw new Error("Invalid token payload");
    }

    // 3. Extract Verified Subject (Clerk User ID)
    const clerkId = payload.sub || payload.user_id;
    if (!clerkId || typeof clerkId !== 'string' || !clerkId.trim()) {
        throw new Error("Invalid token payload: missing user identifier (sub)");
    }

    const trimmedClerkId = clerkId.trim();

    // 4. Retrieve Authoritative User Profile from Clerk Backend API
    let clerkUser = null;

    if (isTest && typeof _mockUserLookup === 'function') {
        clerkUser = await _mockUserLookup(trimmedClerkId);
    } else if (secretKey && secretKey.startsWith('sk_')) {
        try {
            const clerk = createClerkClient({ secretKey });
            clerkUser = await clerk.users.getUser(trimmedClerkId);
        } catch (apiErr) {
            throw new Error(`Failed to retrieve Clerk user profile: ${apiErr.message}`);
        }
    } else if (isTest) {
        // Fallback for tests that do not register a mock user lookup:
        // Adapt legacy test payload if email is directly present
        if (payload.email) {
            clerkUser = {
                id: trimmedClerkId,
                primaryEmailAddressId: 'test_primary_email_id',
                emailAddresses: [{
                    id: 'test_primary_email_id',
                    emailAddress: payload.email,
                    verification: { status: payload.email_verified !== false ? 'verified' : 'unverified' }
                }],
                firstName: payload.name ? payload.name.split(' ')[0] : 'Customer',
                lastName: payload.name ? payload.name.split(' ').slice(1).join(' ') : ''
            };
        } else {
            throw new Error("Clerk user profile not found");
        }
    } else {
        // If jwtKey was used without secretKey, we cannot call Backend API to retrieve the user profile
        throw new ClerkConfigurationError("Clerk secret key (CLERK_SECRET_KEY) is required to retrieve the authoritative user profile");
    }

    if (!clerkUser || typeof clerkUser !== 'object') {
        throw new Error("Clerk user profile not found");
    }

    // 5. Authoritatively Resolve Primary Email and Verification Status
    const emailAddresses = Array.isArray(clerkUser.emailAddresses) ? clerkUser.emailAddresses : [];
    const primaryEmailObj = (clerkUser.primaryEmailAddressId
        ? emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)
        : null) || emailAddresses[0];

    const email = primaryEmailObj?.emailAddress;
    if (!email || typeof email !== 'string' || !email.trim()) {
        throw new Error("Clerk user profile missing primary email address");
    }

    const emailVerified = primaryEmailObj?.verification?.status === 'verified';

    // 6. Authoritatively Resolve Customer Display Name
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim()
              || clerkUser.username
              || 'Customer';

    return {
        clerkId: trimmedClerkId,
        email: email.trim().toLowerCase(),
        emailVerified,
        name: name.trim()
    };
}
