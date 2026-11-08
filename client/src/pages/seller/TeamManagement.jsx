import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    Users,
    UserPlus,
    Search,
    Filter,
    Edit3,
    Trash2,
    CheckCircle2,
    AlertCircle,
    AlertTriangle,
    X,
    Mail,
    Shield,
    Briefcase,
    Eye,
    EyeOff,
    RefreshCw,
    TrendingUp,
    Package
} from '../../components/seller/SellerIcons';

const ROLE_CONFIG = {
    Admin: {
        label: 'Admin',
        badge: 'bg-purple-50 text-purple-700 border-purple-200',
        ring: 'ring-purple-500/20',
        description: 'Full team administration, role assignments, and all seller modules.'
    },
    CEO: {
        label: 'CEO',
        badge: 'bg-amber-50 text-amber-800 border-amber-200',
        ring: 'ring-amber-500/20',
        description: 'View business dashboard, overview, orders, and business reports.'
    },
    CTO: {
        label: 'CTO',
        badge: 'bg-blue-50 text-blue-700 border-blue-200',
        ring: 'ring-blue-500/20',
        description: 'Access technical modules: catalog, stock, chat, reviews, and dashboard.'
    },
    Strategist: {
        label: 'Strategist',
        badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        ring: 'ring-emerald-500/20',
        description: 'Access Analytics, business reports, and product performance insights.'
    }
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

const TeamManagement = () => {
    const { axios, sellerUser, navigate } = useAppContext();
    const currentRole = sellerUser?.role || 'Admin';
    const isCurrentAdmin = currentRole === 'Admin';

    const [team, setTeam] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters & Search
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showMatrixModal, setShowMatrixModal] = useState(false);
    const [selectedMember, setSelectedMember] = useState(null);

    // Form States
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        designation: '',
        role: 'Strategist',
        status: 'Active',
        image: ''
    });
    const [formLoading, setFormLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Fetch team members from backend
    const fetchTeamMembers = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);

        try {
            const { data } = await axios.get('/api/seller/team');
            if (data.success) {
                setTeam(data.team || []);
            } else {
                toast.error(data.message || 'Failed to load team members');
            }
        } catch (error) {
            if (error.response?.status === 403) {
                // Handled by 403 guard
            } else {
                toast.error(error.response?.data?.message || 'Failed to retrieve team');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (isCurrentAdmin) {
            fetchTeamMembers();
        } else {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCurrentAdmin]);

    // Filtered members list
    const filteredTeam = useMemo(() => {
        return team.filter((member) => {
            const matchesSearch =
                member.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                member.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                member.designation?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesRole = roleFilter === 'ALL' || member.role === roleFilter;
            const matchesStatus = statusFilter === 'ALL' || member.status === statusFilter;

            return matchesSearch && matchesRole && matchesStatus;
        });
    }, [team, searchQuery, roleFilter, statusFilter]);

    // KPI Summary
    const stats = useMemo(() => {
        const total = team.length;
        const active = team.filter((m) => m.status === 'Active').length;
        const inactive = team.filter((m) => m.status === 'Inactive').length;
        return { total, active, inactive };
    }, [team]);

    // Open Add Modal
    const handleOpenAddModal = () => {
        setFormData({
            name: '',
            email: '',
            password: '',
            designation: '',
            role: 'Strategist',
            status: 'Active',
            image: ''
        });
        setShowPassword(false);
        setShowAddModal(true);
    };

    // Open Edit Modal
    const handleOpenEditModal = (member) => {
        setSelectedMember(member);
        setFormData({
            name: member.name || '',
            email: member.email || '',
            password: '', // blank unless updating
            designation: member.designation || '',
            role: member.role || 'Strategist',
            status: member.status || 'Active',
            image: member.image || ''
        });
        setShowPassword(false);
        setShowEditModal(true);
    };

    // Open Delete Modal
    const handleOpenDeleteModal = (member) => {
        setSelectedMember(member);
        setShowDeleteModal(true);
    };

    // Check if user is operating on themselves
    const isSelf = (member) => {
        if (!member || !sellerUser) return false;
        return (
            (sellerUser.id && String(member._id) === String(sellerUser.id)) ||
            (sellerUser.email && member.email.toLowerCase() === sellerUser.email.toLowerCase())
        );
    };

    // Submit Add Member
    const handleAddMember = async (e) => {
        e.preventDefault();
        if (formLoading) return;

        // Validations
        if (!formData.name.trim()) return toast.error('Full Name is required');
        if (!formData.email.trim()) return toast.error('Official Email is required');
        if (!formData.password || formData.password.length < 12) {
            return toast.error('Password must be at least 12 characters');
        }
        if (!formData.designation.trim()) return toast.error('Designation is required');

        setFormLoading(true);
        try {
            const payload = {
                ...formData,
                name: formData.name.trim(),
                email: formData.email.trim(),
                designation: formData.designation.trim(),
                image: normalizeTeamImageUrl(formData.image)
            };
            const { data } = await axios.post('/api/seller/team', payload);
            if (data.success) {
                toast.success(data.message || 'Team member added successfully');
                setShowAddModal(false);
                fetchTeamMembers(true);
            } else {
                toast.error(data.message || 'Failed to add member');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error creating team member');
        } finally {
            setFormLoading(false);
        }
    };

    // Submit Edit Member
    const handleUpdateMember = async (e) => {
        e.preventDefault();
        if (formLoading || !selectedMember) return;

        if (!formData.name.trim()) return toast.error('Full Name cannot be empty');
        if (!formData.email.trim()) return toast.error('Official Email cannot be empty');
        if (!formData.designation.trim()) return toast.error('Designation cannot be empty');
        if (formData.password && formData.password.length < 12) {
            return toast.error('Password must be at least 12 characters');
        }

        const payload = {
            name: formData.name.trim(),
            email: formData.email.trim(),
            designation: formData.designation.trim(),
            role: formData.role,
            status: formData.status,
            image: normalizeTeamImageUrl(formData.image)
        };
        if (formData.password) {
            payload.password = formData.password;
        }

        setFormLoading(true);
        try {
            const { data } = await axios.put(`/api/seller/team/${selectedMember._id}`, payload);
            if (data.success) {
                toast.success(data.message || 'Team member updated successfully');
                setShowEditModal(false);
                fetchTeamMembers(true);
            } else {
                toast.error(data.message || 'Failed to update member');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error updating member');
        } finally {
            setFormLoading(false);
        }
    };

    // Toggle Activate / Deactivate
    const handleToggleStatus = async (member) => {
        if (isSelf(member)) {
            return toast.error('You cannot deactivate your own account');
        }

        const newStatus = member.status === 'Active' ? 'Inactive' : 'Active';
        try {
            const { data } = await axios.patch(`/api/seller/team/${member._id}/status`, {
                status: newStatus
            });
            if (data.success) {
                toast.success(data.message || `Member marked as ${newStatus}`);
                fetchTeamMembers(true);
            } else {
                toast.error(data.message || 'Failed to change status');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error updating member status');
        }
    };

    // Submit Delete Member
    const handleDeleteMember = async () => {
        if (!selectedMember || formLoading) return;

        if (isSelf(selectedMember)) {
            return toast.error('You cannot delete your own account');
        }

        setFormLoading(true);
        try {
            const { data } = await axios.delete(`/api/seller/team/${selectedMember._id}`);
            if (data.success) {
                toast.success(data.message || 'Team member deleted successfully');
                setShowDeleteModal(false);
                setSelectedMember(null);
                fetchTeamMembers(true);
            } else {
                toast.error(data.message || 'Failed to delete member');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error deleting member');
        } finally {
            setFormLoading(false);
        }
    };

    // 403 Forbidden Access State for Non-Admin direct access
    if (!isCurrentAdmin) {
        return (
            <div className="p-6 max-w-4xl mx-auto my-12 font-sans">
                <div className="bg-white rounded-2xl border border-rose-200 shadow-sm p-8 text-center space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                        <Shield className="w-8 h-8" />
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                        HTTP 403 - Forbidden Access
                    </span>
                    <h2 className="text-2xl font-bold text-slate-900">Access Denied: Admin Privilege Required</h2>
                    <p className="text-sm text-slate-600 max-w-lg mx-auto">
                        Your assigned role <span className="font-semibold text-slate-900">({currentRole})</span> does not have permission to access Team Management. This section is restricted strictly to Administrators.
                    </p>
                    <div className="pt-4">
                        <button
                            type="button"
                            onClick={() => navigate('/seller')}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 shadow-sm transition-all cursor-pointer"
                        >
                            Return to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto font-sans">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Team Management</h1>
                        <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {team.length} Members
                        </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                        Administer team members, designations, role assignments, and dashboard access permissions.
                    </p>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                    <button
                        type="button"
                        onClick={() => setShowMatrixModal(true)}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs transition-all cursor-pointer"
                        title="View fixed permissions matrix"
                    >
                        <Shield className="w-4 h-4 text-emerald-600" />
                        <span>Role Matrix</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleOpenAddModal}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-500/20 transition-all cursor-pointer"
                    >
                        <UserPlus className="w-4 h-4" />
                        <span>Add New Member</span>
                    </button>
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Members</p>
                        <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                        <Users className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Active Members</p>
                        <p className="text-2xl font-bold text-emerald-700 mt-1">{stats.active}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Deactivated</p>
                        <p className="text-2xl font-bold text-slate-700 mt-1">{stats.inactive}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                        <AlertCircle className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                {/* Search Input */}
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name, email, or designation..."
                        className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-400 text-slate-800"
                    />
                </div>

                {/* Filter Dropdowns */}
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    {/* Role Filter */}
                    <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-slate-500 font-medium">Role:</span>
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg px-2.5 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                            <option value="ALL">All Roles</option>
                            <option value="Admin">Admin</option>
                            <option value="CEO">CEO</option>
                            <option value="CTO">CTO</option>
                            <option value="Strategist">Strategist</option>
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-slate-500 font-medium">Status:</span>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg px-2.5 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                            <option value="ALL">All Status</option>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                        </select>
                    </div>

                    {/* Refresh Button */}
                    <button
                        type="button"
                        onClick={() => fetchTeamMembers(true)}
                        disabled={refreshing}
                        className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                        title="Refresh member list"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-600' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Member Cards Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((n) => (
                        <div key={n} className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-full bg-slate-200" />
                                <div className="space-y-2 flex-1">
                                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                                </div>
                            </div>
                            <div className="h-3 bg-slate-200 rounded w-full" />
                            <div className="h-8 bg-slate-200 rounded-xl" />
                        </div>
                    ))}
                </div>
            ) : filteredTeam.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <Users className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-800">No team members found</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        {searchQuery || roleFilter !== 'ALL' || statusFilter !== 'ALL'
                            ? 'No members match the selected filters. Try clearing your search query or reset filter options.'
                            : 'Get started by adding your first team member using the button above.'}
                    </p>
                    {(searchQuery || roleFilter !== 'ALL' || statusFilter !== 'ALL') && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery('');
                                setRoleFilter('ALL');
                                setStatusFilter('ALL');
                            }}
                            className="mt-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700 underline"
                        >
                            Reset filters
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredTeam.map((member) => {
                        const roleCfg = ROLE_CONFIG[member.role] || ROLE_CONFIG.Strategist;
                        const selfUser = isSelf(member);

                        return (
                            <div
                                key={member._id}
                                className={`bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-2xs hover:shadow-md ${
                                    member.status === 'Inactive'
                                        ? 'border-slate-200/70 bg-slate-50/50 opacity-80'
                                        : 'border-slate-200 hover:border-emerald-300'
                                }`}
                            >
                                <div className="p-5 space-y-4">
                                    {/* Top Card Header: Profile Image & Status Badge */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="relative">
                                            {/* Circular Profile Image */}
                                            {member.image ? (
                                                <img
                                                    src={normalizeTeamImageUrl(member.image)}
                                                    alt={member.name}
                                                    className="w-14 h-14 rounded-full object-cover border-2 border-slate-100 shadow-xs"
                                                    onError={(e) => {
                                                        e.currentTarget.onerror = null;
                                                        e.currentTarget.style.display = 'none';
                                                        if (e.currentTarget.nextSibling) {
                                                            e.currentTarget.nextSibling.style.display = 'flex';
                                                        }
                                                    }}
                                                />
                                            ) : null}
                                            <div
                                                className={`w-14 h-14 rounded-full bg-linear-to-tr from-emerald-600 to-teal-500 text-white font-bold text-lg flex items-center justify-center uppercase shadow-xs ${
                                                    member.image ? 'hidden' : 'flex'
                                                }`}
                                            >
                                                {member.name.charAt(0)}
                                            </div>

                                            {/* Online/Active Indicator Dot */}
                                            <span
                                                className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${
                                                    member.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'
                                                }`}
                                                title={`Status: ${member.status}`}
                                            />
                                        </div>

                                        {/* Status Pill & Self Tag */}
                                        <div className="flex flex-col items-end gap-1.5">
                                            <span
                                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                                                    member.status === 'Active'
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : 'bg-rose-50 text-rose-700 border-rose-200'
                                                }`}
                                            >
                                                <span
                                                    className={`w-1.5 h-1.5 rounded-full ${
                                                        member.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                                                    }`}
                                                />
                                                {member.status}
                                            </span>

                                            {selfUser && (
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                                    You
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Name & Designation */}
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900 truncate" title={member.name}>
                                            {member.name}
                                        </h3>
                                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500">
                                            <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <span className="truncate font-medium" title={member.designation}>
                                                {member.designation}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Email */}
                                    <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/60">
                                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <a
                                            href={`mailto:${member.email}`}
                                            className="truncate hover:text-emerald-700 transition-colors"
                                            title={member.email}
                                        >
                                            {member.email}
                                        </a>
                                    </div>

                                    {/* Assigned Role Pill */}
                                    <div>
                                        <span
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${roleCfg.badge}`}
                                        >
                                            <Shield className="w-3.5 h-3.5" />
                                            {member.role}
                                        </span>
                                        <p className="mt-1 text-[11px] text-slate-500 leading-tight">
                                            {roleCfg.description}
                                        </p>
                                    </div>
                                </div>

                                {/* Card Actions Footer */}
                                <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-200/70 flex items-center justify-between gap-2">
                                    {/* Edit Button */}
                                    <button
                                        type="button"
                                        onClick={() => handleOpenEditModal(member)}
                                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-emerald-700 px-2.5 py-1.5 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                                        title="Edit team member"
                                    >
                                        <Edit3 className="w-3.5 h-3.5" />
                                        <span>Edit</span>
                                    </button>

                                    <div className="flex items-center gap-1.5">
                                        {/* Activate / Deactivate Toggle */}
                                        <button
                                            type="button"
                                            onClick={() => handleToggleStatus(member)}
                                            disabled={selfUser}
                                            className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                                                selfUser
                                                    ? 'opacity-40 cursor-not-allowed border-slate-200 text-slate-400'
                                                    : member.status === 'Active'
                                                    ? 'text-amber-700 hover:bg-amber-50 border-amber-200 bg-white'
                                                    : 'text-emerald-700 hover:bg-emerald-50 border-emerald-200 bg-white'
                                            }`}
                                            title={selfUser ? 'You cannot deactivate yourself' : member.status === 'Active' ? 'Deactivate member' : 'Activate member'}
                                        >
                                            {member.status === 'Active' ? 'Deactivate' : 'Activate'}
                                        </button>

                                        {/* Delete Button */}
                                        <button
                                            type="button"
                                            onClick={() => handleOpenDeleteModal(member)}
                                            disabled={selfUser}
                                            className={`p-1.5 rounded-lg transition-all ${
                                                selfUser
                                                    ? 'opacity-40 cursor-not-allowed text-slate-300'
                                                    : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 cursor-pointer'
                                            }`}
                                            title={selfUser ? 'You cannot delete yourself' : 'Delete member'}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* Modal: Add New Team Member */}
            {/* ------------------------------------------------------------- */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                                    <UserPlus className="w-5 h-5" />
                                </div>
                                <h3 className="text-base font-bold text-slate-900">Add New Team Member</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleAddMember} className="p-6 space-y-4">
                            {/* Full Name */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Full Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. John Doe"
                                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            {/* Official Email */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Official Email Address <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="e.g. jdoe@greencart.com"
                                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Account Password <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        minLength={12}
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        placeholder="Minimum 12 characters"
                                        className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Designation */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Designation (Job Title) <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.designation}
                                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                                    placeholder="e.g. Lead Technical Architect, VP Operations"
                                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            {/* Role Selection */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                        Assigned Role <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                        className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                                    >
                                        <option value="Admin">Admin (Full Access & Team)</option>
                                        <option value="CEO">CEO (Dashboard, Orders & Reports)</option>
                                        <option value="CTO">CTO (Technical & System Modules)</option>
                                        <option value="Strategist">Strategist (Analytics & Insights)</option>
                                    </select>
                                </div>

                                {/* Initial Status */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                        Initial Status <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>

                            {/* Profile Image URL */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Profile Image URL <span className="text-slate-400 font-normal lowercase">(optional)</span>
                                </label>
                                <input
                                    type="url"
                                    value={formData.image}
                                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                                    placeholder="https://example.com/avatar.jpg"
                                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            {/* Modal Actions */}
                            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={formLoading}
                                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    {formLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                                    <span>Create Member</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* Modal: Edit Team Member */}
            {/* ------------------------------------------------------------- */}
            {showEditModal && selectedMember && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                                    <Edit3 className="w-5 h-5" />
                                </div>
                                <h3 className="text-base font-bold text-slate-900">Edit Team Member</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowEditModal(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateMember} className="p-6 space-y-4">
                            {/* Full Name */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Full Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            {/* Official Email */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Official Email Address <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            {/* Optional Password Update */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Reset Password <span className="text-slate-400 font-normal lowercase">(leave blank to keep unchanged)</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        minLength={12}
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        placeholder="••••••••"
                                        className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Designation */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Designation <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.designation}
                                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            {/* Role and Status */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                        Assigned Role {isSelf(selectedMember) && <span className="text-amber-600 lowercase">(locked for self)</span>}
                                    </label>
                                    <select
                                        disabled={isSelf(selectedMember)}
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                        className={`w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium ${
                                            isSelf(selectedMember) ? 'opacity-60 cursor-not-allowed' : ''
                                        }`}
                                    >
                                        <option value="Admin">Admin (Full Access & Team)</option>
                                        <option value="CEO">CEO (Dashboard, Orders & Reports)</option>
                                        <option value="CTO">CTO (Technical & System Modules)</option>
                                        <option value="Strategist">Strategist (Analytics & Insights)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                        Account Status {isSelf(selectedMember) && <span className="text-amber-600 lowercase">(locked for self)</span>}
                                    </label>
                                    <select
                                        disabled={isSelf(selectedMember)}
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className={`w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium ${
                                            isSelf(selectedMember) ? 'opacity-60 cursor-not-allowed' : ''
                                        }`}
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>

                            {/* Profile Image URL */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Profile Image URL
                                </label>
                                <input
                                    type="url"
                                    value={formData.image}
                                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                                    placeholder="https://example.com/avatar.jpg"
                                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            {/* Modal Actions */}
                            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={formLoading}
                                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    {formLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                                    <span>Save Changes</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* Modal: Delete Confirmation */}
            {/* ------------------------------------------------------------- */}
            {showDeleteModal && selectedMember && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
                        <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6" />
                        </div>

                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Remove Team Member?</h3>
                            <p className="mt-1 text-sm text-slate-600">
                                Are you sure you want to remove <span className="font-semibold text-slate-900">{selectedMember.name}</span> ({selectedMember.email})?
                                This will immediately revoke their access to the GreenCart Seller Center.
                            </p>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-800">
                            <strong>Note:</strong> This action permanently removes the user's login credentials and team records from the database.
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowDeleteModal(false)}
                                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteMember}
                                disabled={formLoading}
                                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {formLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                                <span>Delete Member</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* Modal: Fixed Role & Permission Matrix Reference */}
            {/* ------------------------------------------------------------- */}
            {showMatrixModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                            <div className="flex items-center gap-2">
                                <Shield className="w-5 h-5 text-emerald-600" />
                                <h3 className="text-base font-bold text-slate-900">GreenCart Fixed Role & Permission Matrix</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowMatrixModal(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 leading-relaxed">
                                Permissions are strictly enforced by backend middleware on every API call following the principle of least privilege.
                            </div>

                            <div className="space-y-3">
                                {/* Admin */}
                                <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-sm text-purple-900">Admin</span>
                                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                                            Full Administrative Access
                                        </span>
                                    </div>
                                    <ul className="mt-2 text-xs text-purple-950 space-y-1 list-disc list-inside">
                                        <li>Full Team Management access (create, edit, toggle status, delete).</li>
                                        <li>Manage team role assignments and designations.</li>
                                        <li>Access all permitted Seller Dashboard modules.</li>
                                    </ul>
                                </div>

                                {/* CEO */}
                                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-sm text-amber-900">CEO</span>
                                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                                            Executive Business Oversight
                                        </span>
                                    </div>
                                    <ul className="mt-2 text-xs text-amber-950 space-y-1 list-disc list-inside">
                                        <li>View business sales analytics and dashboard overview.</li>
                                        <li>View customer orders and business reports.</li>
                                        <li>No access to team administration or permission management.</li>
                                    </ul>
                                </div>

                                {/* CTO */}
                                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-sm text-blue-900">CTO</span>
                                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                                            Technical & System Operations
                                        </span>
                                    </div>
                                    <ul className="mt-2 text-xs text-blue-950 space-y-1 list-disc list-inside">
                                        <li>Access technical catalog and inventory management.</li>
                                        <li>Manage stock levels, customer messages, and reviews moderation.</li>
                                        <li>No access to Admin-only team administration.</li>
                                    </ul>
                                </div>

                                {/* Strategist */}
                                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-sm text-emerald-900">Strategist</span>
                                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                            Analytics & Market Performance
                                        </span>
                                    </div>
                                    <ul className="mt-2 text-xs text-emerald-950 space-y-1 list-disc list-inside">
                                        <li>Access Analytics and business sales reports.</li>
                                        <li>View product performance and sales insights.</li>
                                        <li>No permission to modify orders, products, or team members.</li>
                                    </ul>
                                </div>
                            </div>

                            <div className="pt-2 text-right">
                                <button
                                    type="button"
                                    onClick={() => setShowMatrixModal(false)}
                                    className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamManagement;
