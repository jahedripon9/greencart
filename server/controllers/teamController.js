import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import TeamMember from "../models/TeamMember.js";
import { logActivity } from "../services/activityLogService.js";

const VALID_ROLES = ['Admin', 'CEO', 'CTO', 'Strategist'];
const VALID_STATUSES = ['Active', 'Inactive'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COMMON_WEAK_PASSWORDS = new Set([
    'password',
    'password123',
    '12345678',
    '123456789',
    'admin123',
    'admin1234',
    'greencart123',
    'qwerty123',
    'welcome123'
]);

export const isWeakPassword = (password) => {
    if (!password || typeof password !== 'string') return true;
    return COMMON_WEAK_PASSWORDS.has(password.trim().toLowerCase());
};

/**
 * Safely normalizes Google Drive image URLs to Google user-content embed URLs (lh3.googleusercontent.com/d/FILE_ID)
 * to prevent browser blocking caused by Google's Cross-Origin-Resource-Policy (CORP) header.
 * Non-Google URLs (Unsplash, Cloudinary, data URIs, etc.) are preserved unchanged.
 */
export const normalizeTeamImageUrl = (image) => {
    if (!image || typeof image !== 'string') return image;
    const trimmed = image.trim();
    if (!trimmed) return trimmed;

    try {
        const parsed = new URL(trimmed);
        const host = parsed.hostname.toLowerCase();
        if (host === 'drive.google.com' || host === 'www.drive.google.com' || host === 'docs.google.com') {
            let fileId = null;

            // Pattern 1: /file/d/FILE_ID (e.g. /file/d/FILE_ID/view)
            const fileMatch = parsed.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i);
            if (fileMatch && fileMatch[1]) {
                fileId = fileMatch[1];
            }

            // Pattern 2: query parameter id=FILE_ID (e.g. /uc?id=..., /open?id=..., /uc?export=view&id=...)
            if (!fileId) {
                const idParam = parsed.searchParams.get('id');
                if (idParam && /^[a-zA-Z0-9_-]+$/.test(idParam)) {
                    fileId = idParam;
                }
            }

            if (fileId) {
                return `https://lh3.googleusercontent.com/d/${fileId}`;
            }
        }
    } catch {
        // Not a standard URL (e.g. data URI) or malformed, return trimmed as-is
    }

    return trimmed;
};

export const isValidTeamImage = (image) => {
    if (!image || typeof image !== 'string') return true;
    const trimmed = image.trim();
    if (!trimmed) return true;

    if (trimmed.length > 2048) {
        return false;
    }

    const lower = trimmed.toLowerCase();
    if (lower.startsWith('javascript:') || lower.startsWith('file:') || lower.startsWith('vbscript:')) {
        return false;
    }

    // Explicitly reject SVG and GIF in any form or MIME encoding
    if (lower.includes('image/svg') || lower.includes('<svg') || lower.includes('image/gif')) {
        return false;
    }

    const httpRegex = /^https?:\/\/.+/i;
    const dataUriRegex = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i;

    return httpRegex.test(trimmed) || dataUriRegex.test(trimmed);
};

/**
 * Get all team members (Admin Only)
 * Passwords are unconditionally excluded.
 */
export const getTeamMembers = async (req, res) => {
    try {
        const members = await TeamMember.find({})
            .select('-password')
            .sort({ createdAt: -1 })
            .lean();

        const formattedMembers = members.map(m => ({
            ...m,
            image: m.image ? normalizeTeamImageUrl(m.image) : ''
        }));

        return res.json({ success: true, team: formattedMembers });
    } catch (error) {
        console.error("Get team members error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Get single team member by ID (Admin Only)
 */
export const getTeamMemberById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid team member ID format" });
        }

        const member = await TeamMember.findById(id).select('-password').lean();
        if (!member) {
            return res.status(404).json({ success: false, message: "Team member not found" });
        }

        if (member.image) {
            member.image = normalizeTeamImageUrl(member.image);
        }

        return res.json({ success: true, member });
    } catch (error) {
        console.error("Get team member by id error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Add a new team member (Admin Only)
 * Validates all required fields, enforces uniqueness, hashes password.
 */
export const addTeamMember = async (req, res) => {
    try {
        const { name, email, password, designation, role, status = 'Active', image = '' } = req.body;

        // 1. Required field validations
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ success: false, message: "Full Name is required" });
        }

        if (!email || typeof email !== 'string' || !email.trim()) {
            return res.status(400).json({ success: false, message: "Official Email is required" });
        }

        const trimmedEmail = email.trim().toLowerCase();
        if (!EMAIL_REGEX.test(trimmedEmail)) {
            return res.status(400).json({ success: false, message: "Please provide a valid official email address" });
        }

        if (!password || typeof password !== 'string' || password.length < 12) {
            return res.status(400).json({ success: false, message: "Password is required and must be at least 12 characters" });
        }

        if (isWeakPassword(password)) {
            return res.status(400).json({ success: false, message: "Password is too common or easily guessed. Please choose a stronger password." });
        }

        const normalizedImage = normalizeTeamImageUrl(image);

        if (normalizedImage !== undefined && normalizedImage !== null && normalizedImage !== '') {
            if (!isValidTeamImage(normalizedImage)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid profile image. Must be a valid HTTP(S) URL or safe image data URI (PNG, JPEG, WebP only, max 2048 characters)."
                });
            }
        }

        if (!designation || typeof designation !== 'string' || !designation.trim()) {
            return res.status(400).json({ success: false, message: "Designation is required" });
        }

        if (!role || !VALID_ROLES.includes(role)) {
            return res.status(400).json({
                success: false,
                message: `Role must be one of: ${VALID_ROLES.join(', ')}`
            });
        }

        const formattedStatus = status === 'Inactive' ? 'Inactive' : 'Active';

        // 2. Prevent duplicate email registrations (against root seller and existing team members)
        const rootSellerEmail = process.env.SELLER_EMAIL?.toLowerCase();
        if (rootSellerEmail && trimmedEmail === rootSellerEmail) {
            return res.status(400).json({ success: false, message: "This email address is reserved and already in use" });
        }

        const existingMember = await TeamMember.findOne({ email: trimmedEmail });
        if (existingMember) {
            return res.status(400).json({ success: false, message: "A team member with this email address already exists" });
        }

        // 3. Password hashing
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4. Create team member document
        const newMember = new TeamMember({
            name: name.trim(),
            email: trimmedEmail,
            password: hashedPassword,
            designation: designation.trim(),
            role,
            status: formattedStatus,
            image: typeof normalizedImage === 'string' ? normalizedImage.trim() : ''
        });

        await newMember.save();

        const safeMember = newMember.toSafeObject();

        await logActivity({
            req,
            action: 'CREATE',
            entityType: 'TEAM_MEMBER',
            entityId: newMember._id,
            entityName: newMember.name,
            description: `Added team member "${newMember.name}" with role ${newMember.role}`,
            after: safeMember
        });

        return res.status(201).json({
            success: true,
            message: "Team member added successfully",
            member: safeMember
        });
    } catch (error) {
        console.error("Add team member error:", error.message);
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "A team member with this email address already exists" });
        }
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Edit an existing team member (Admin Only)
 * Prevents self-demotion or self-deactivation.
 */
export const updateTeamMember = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid team member ID format" });
        }

        const member = await TeamMember.findById(id);
        if (!member) {
            return res.status(404).json({ success: false, message: "Team member not found" });
        }

        const beforeMember = {
            name: member.name,
            email: member.email,
            designation: member.designation,
            role: member.role,
            status: member.status,
            image: member.image || ''
        };

        const isEditingSelf = (req.sellerId && String(req.sellerId) === String(member._id)) ||
            (req.sellerEmail && req.sellerEmail.toLowerCase() === member.email.toLowerCase());

        const { name, email, designation, role, status, image, password } = req.body;

        // Self-protection: Prevent changing own role or deactivating own account
        if (isEditingSelf) {
            if (role !== undefined && role !== member.role) {
                return res.status(403).json({ success: false, message: "You cannot change your own role" });
            }
            if (status !== undefined && status === 'Inactive' && member.status === 'Active') {
                return res.status(403).json({ success: false, message: "You cannot deactivate your own account" });
            }
        }

        // Validate and update email if provided
        if (email !== undefined) {
            const trimmedEmail = String(email).trim().toLowerCase();
            if (!EMAIL_REGEX.test(trimmedEmail)) {
                return res.status(400).json({ success: false, message: "Please provide a valid official email address" });
            }

            if (trimmedEmail !== member.email) {
                const rootSellerEmail = process.env.SELLER_EMAIL?.toLowerCase();
                if (rootSellerEmail && trimmedEmail === rootSellerEmail) {
                    return res.status(400).json({ success: false, message: "This email address is reserved and already in use" });
                }

                const existing = await TeamMember.findOne({ email: trimmedEmail, _id: { $ne: id } });
                if (existing) {
                    return res.status(400).json({ success: false, message: "Email is already in use by another team member" });
                }
                member.email = trimmedEmail;
            }
        }

        // Validate and update role if provided
        if (role !== undefined) {
            if (!VALID_ROLES.includes(role)) {
                return res.status(400).json({
                    success: false,
                    message: `Role must be one of: ${VALID_ROLES.join(', ')}`
                });
            }
            member.role = role;
        }

        // Validate and update status if provided
        if (status !== undefined) {
            if (!VALID_STATUSES.includes(status)) {
                return res.status(400).json({ success: false, message: "Status must be either Active or Inactive" });
            }
            member.status = status;
        }

        // Update name
        if (name !== undefined) {
            if (typeof name !== 'string' || !name.trim()) {
                return res.status(400).json({ success: false, message: "Full Name cannot be empty" });
            }
            member.name = name.trim();
        }

        // Update designation
        if (designation !== undefined) {
            if (typeof designation !== 'string' || !designation.trim()) {
                return res.status(400).json({ success: false, message: "Designation cannot be empty" });
            }
            member.designation = designation.trim();
        }

        // Update image
        if (image !== undefined) {
            const normalizedImage = normalizeTeamImageUrl(image);
            if (normalizedImage !== '' && normalizedImage !== null && !isValidTeamImage(normalizedImage)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid profile image. Must be a valid HTTP(S) URL or safe image data URI (PNG, JPEG, WebP only, max 2048 characters)."
                });
            }
            member.image = typeof normalizedImage === 'string' ? normalizedImage.trim() : '';
        }

        // Update password if provided
        if (password !== undefined && password !== '') {
            if (typeof password !== 'string' || password.length < 12) {
                return res.status(400).json({ success: false, message: "New password must be at least 12 characters" });
            }
            if (isWeakPassword(password)) {
                return res.status(400).json({ success: false, message: "Password is too common or easily guessed. Please choose a stronger password." });
            }
            member.password = await bcrypt.hash(password, 10);
            member.tokenVersion = (member.tokenVersion || 0) + 1;
        }

        await member.save();

        const safeMember = member.toSafeObject();

        const roleChanged = role !== undefined && role !== beforeMember.role;
        const desc = roleChanged
            ? `Changed role of team member "${member.name}" from ${beforeMember.role} to ${member.role}`
            : `Updated team member "${member.name}"`;

        await logActivity({
            req,
            action: 'UPDATE',
            entityType: 'TEAM_MEMBER',
            entityId: member._id,
            entityName: member.name,
            description: desc,
            before: beforeMember,
            after: {
                name: member.name,
                email: member.email,
                designation: member.designation,
                role: member.role,
                status: member.status,
                image: member.image || ''
            }
        });

        return res.json({
            success: true,
            message: "Team member updated successfully",
            member: safeMember
        });
    } catch (error) {
        console.error("Update team member error:", error.message);
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "Email is already in use by another team member" });
        }
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Activate or Deactivate team member (Admin Only)
 * Prevents self-deactivation.
 */
export const toggleTeamMemberStatus = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid team member ID format" });
        }

        const member = await TeamMember.findById(id);
        if (!member) {
            return res.status(404).json({ success: false, message: "Team member not found" });
        }

        const beforeMember = {
            name: member.name,
            email: member.email,
            designation: member.designation,
            role: member.role,
            status: member.status,
            image: member.image || ''
        };

        const isEditingSelf = (req.sellerId && String(req.sellerId) === String(member._id)) ||
            (req.sellerEmail && req.sellerEmail.toLowerCase() === member.email.toLowerCase());

        const requestedStatus = req.body?.status;
        const targetStatus = requestedStatus
            ? (VALID_STATUSES.includes(requestedStatus) ? requestedStatus : null)
            : (member.status === 'Active' ? 'Inactive' : 'Active');

        if (!targetStatus) {
            return res.status(400).json({ success: false, message: "Status must be either Active or Inactive" });
        }

        if (isEditingSelf && targetStatus === 'Inactive') {
            return res.status(403).json({ success: false, message: "You cannot deactivate your own account" });
        }

        member.status = targetStatus;
        await member.save();

        const safeMember = member.toSafeObject();

        await logActivity({
            req,
            action: 'STATUS_CHANGE',
            entityType: 'TEAM_MEMBER',
            entityId: member._id,
            entityName: member.name,
            description: `${targetStatus === 'Active' ? 'Activated' : 'Deactivated'} team member "${member.name}"`,
            before: { status: beforeMember.status },
            after: { status: targetStatus }
        });

        return res.json({
            success: true,
            message: `Team member ${targetStatus === 'Active' ? 'activated' : 'deactivated'} successfully`,
            member: safeMember
        });
    } catch (error) {
        console.error("Toggle team member status error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Delete a team member (Admin Only)
 * Prevents self-deletion.
 */
export const deleteTeamMember = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid team member ID format" });
        }

        const member = await TeamMember.findById(id);
        if (!member) {
            return res.status(404).json({ success: false, message: "Team member not found" });
        }

        const isDeletingSelf = (req.sellerId && String(req.sellerId) === String(member._id)) ||
            (req.sellerEmail && req.sellerEmail.toLowerCase() === member.email.toLowerCase());

        if (isDeletingSelf) {
            return res.status(403).json({ success: false, message: "You cannot delete your own account" });
        }

        const memberData = member.toSafeObject();

        await TeamMember.findByIdAndDelete(id);

        await logActivity({
            req,
            action: 'DELETE',
            entityType: 'TEAM_MEMBER',
            entityId: member._id,
            entityName: member.name,
            description: `Deleted team member "${member.name}"`,
            before: memberData
        });

        return res.json({
            success: true,
            message: "Team member deleted successfully"
        });
    } catch (error) {
        console.error("Delete team member error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
