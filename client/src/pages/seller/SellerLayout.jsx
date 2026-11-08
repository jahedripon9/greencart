import React, { useState, useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { assets } from "../../assets/assets";
import { useAppContext } from "../../context/AppContext";
import toast from "react-hot-toast";
import {
    LayoutDashboard,
    PlusCircle,
    Package,
    ShoppingBag,
    MessageSquare,
    Star,
    LogOut,
    ExternalLink,
    Menu,
    X,
    Store,
    Users,
    Shield,
    Contact,
    Bell,
    Ticket,
    History,
    RotateCcw
} from "../../components/seller/SellerIcons";
import NotificationDropdown from "../../components/seller/NotificationDropdown";

const SellerLayout = () => {
    const { axios, navigate, sellerUser, setIsSeller, setSellerUser } = useAppContext();
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const currentRole = sellerUser?.role || 'Admin';

    // Auto-close mobile menu on route change
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);

    // Prevent body scroll when mobile drawer is open
    useEffect(() => {
        if (mobileMenuOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [mobileMenuOpen]);

    const isItemActive = (itemPath, isNavLinkActive) => {
        if (itemPath === "/seller") {
            return location.pathname === "/seller" || location.pathname === "/seller/dashboard";
        }
        return isNavLinkActive;
    };

    // Role-filtered navigation matrix
    const allLinks = [
        { name: "Dashboard", path: "/seller", icon: LayoutDashboard, exact: true, roles: ['Admin', 'CEO', 'CTO', 'Strategist'] },
        { name: "Inventory", path: "/seller/product-list", icon: Package, exact: false, roles: ['Admin', 'CTO', 'Strategist'] },
        { name: "Add Product", path: "/seller/add-product", icon: PlusCircle, exact: false, roles: ['Admin', 'CTO'] },
        { name: "Orders", path: "/seller/orders", icon: ShoppingBag, exact: false, roles: ['Admin', 'CEO', 'CTO'] },
        { name: "Returns", path: "/seller/returns", icon: RotateCcw, exact: false, roles: ['Admin', 'CEO', 'CTO'] },
        { name: "Notifications", path: "/seller/notifications", icon: Bell, exact: false, roles: ['Admin', 'CEO', 'CTO', 'Strategist'] },
        { name: "Messages", path: "/seller/messages", icon: MessageSquare, exact: false, roles: ['Admin', 'CTO'] },
        { name: "Reviews", path: "/seller/reviews", icon: Star, exact: false, roles: ['Admin', 'CEO', 'CTO'] },
        { name: "Contacts", path: "/seller/contacts", icon: Contact, exact: false, roles: ['Admin', 'CEO', 'CTO', 'Strategist'] },
        { name: "Coupons", path: "/seller/coupons", icon: Ticket, exact: false, roles: ['Admin'] },
        { name: "Store Content", path: "/seller/store-content", icon: Store, exact: false, roles: ['Admin'] },
        { name: "Team", path: "/seller/team", icon: Users, exact: false, roles: ['Admin'] },
        { name: "Activity Logs", path: "/seller/activity-logs", icon: History, exact: false, roles: ['Admin'] },
    ];

    const sidebarLinks = allLinks.filter(item => item.roles.includes(currentRole));

    const logout = async () => {
        try {
            const { data } = await axios.get('/api/seller/logout');
            if (data.success) {
                toast.success(data.message || "Logged out successfully");
                setIsSeller(false);
                if (setSellerUser) setSellerUser(null);
                navigate("/");
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between shadow-xs">
                {/* Brand & Mobile Hamburger */}
                <div className="flex items-center gap-3 sm:gap-4">
                    <button
                        type="button"
                        onClick={() => setMobileMenuOpen(prev => !prev)}
                        className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                    >
                        {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>

                    <Link to="/seller" className="flex items-center gap-2.5 group">
                        <img src={assets.logo} className="h-7 sm:h-8 w-auto object-contain cursor-pointer transition-transform group-hover:scale-102" alt="GreenCart" />
                        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                            Seller Center
                        </span>
                    </Link>
                </div>

                {/* Right Actions: Store Status & Profile & Logout */}
                <div className="flex items-center gap-2.5 sm:gap-4">
                    {/* Live Store Pill (hidden on tiny screens) */}
                    <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200/70">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Store Online</span>
                    </div>

                    {/* View Customer Store */}
                    <Link
                        to="/"
                        target="_blank"
                        rel="noreferrer"
                        className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/70 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors"
                        title="View customer catalog"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>View Store</span>
                    </Link>

                    {/* Notification Center Popover */}
                    <NotificationDropdown />

                    {/* Team User Profile Chip with Dynamic Role Badge */}
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100/70 border border-slate-200/60 text-xs text-slate-700">
                        {sellerUser?.image ? (
                            <img
                                src={sellerUser.image}
                                alt={sellerUser.name || "User"}
                                className="w-6 h-6 rounded-full object-cover border border-emerald-400 shadow-xs"
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
                            className={`w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs ${sellerUser?.image ? 'hidden' : 'flex'}`}
                        >
                            {(sellerUser?.name || "Merchant Admin").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 text-left">
                            <span className="hidden sm:inline font-medium text-slate-900 truncate max-w-[120px]">
                                {sellerUser?.name || "Merchant Admin"}
                            </span>
                            <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                    currentRole === 'Admin'
                                        ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                        : currentRole === 'CEO'
                                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                        : currentRole === 'CTO'
                                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                }`}
                            >
                                {currentRole}
                            </span>
                        </div>
                    </div>

                    {/* Logout Button */}
                    <button
                        type="button"
                        onClick={logout}
                        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 px-3 sm:px-3.5 py-1.5 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="hidden sm:inline">Logout</span>
                    </button>
                </div>
            </header>

            {/* Layout Body: Sidebar + Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Desktop Sidebar (hidden on mobile, visible on md+) */}
                <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200/80 shrink-0 h-[calc(100vh-64px)] justify-between">
                    {/* Navigation Links */}
                    <div className="p-3.5 space-y-1 overflow-y-auto">
                        <p className="px-3 pt-2 pb-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Management
                        </p>
                        {sidebarLinks.map((item) => {
                            const IconComponent = item.icon;
                            return (
                                <NavLink
                                    to={item.path}
                                    key={item.name}
                                    end={item.exact}
                                    className={({ isActive }) => {
                                        const active = isItemActive(item.path, isActive);
                                        return `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                                            active
                                                ? "bg-emerald-50 text-emerald-800 font-semibold shadow-xs border-l-4 border-emerald-600"
                                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                                        }`;
                                    }}
                                >
                                    {({ isActive }) => {
                                        const active = isItemActive(item.path, isActive);
                                        return (
                                            <>
                                                <IconComponent
                                                    className={`w-5 h-5 transition-colors ${
                                                        active ? "text-emerald-600" : "text-slate-400 group-hover:text-slate-600"
                                                    }`}
                                                />
                                                <span className="truncate">{item.name}</span>
                                            </>
                                        );
                                    }}
                                </NavLink>
                            );
                        })}
                    </div>

                    {/* Sidebar Footer Card */}
                    <div className="p-3.5 border-t border-slate-200/80 bg-slate-50/50">
                        <div className="p-3 rounded-xl bg-white border border-slate-200/70 shadow-2xs">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                                <Store className="w-4 h-4 text-emerald-600" />
                                <span>GreenCart Merchant</span>
                            </div>
                            <p className="mt-1 text-[11px] text-slate-500 leading-tight">
                                High-performance grocery store portal.
                            </p>
                        </div>
                    </div>
                </aside>

                {/* Mobile Drawer (Slides in on mobile when toggled) */}
                {mobileMenuOpen && (
                    <div className="md:hidden fixed inset-0 z-50 flex">
                        {/* Backdrop Overlay */}
                        <div
                            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
                            onClick={() => setMobileMenuOpen(false)}
                            aria-hidden="true"
                        />

                        {/* Slide-out Menu Panel */}
                        <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white shadow-2xl border-r border-slate-200">
                            {/* Drawer Header */}
                            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                                <div className="flex items-center gap-2">
                                    <img src={assets.logo} className="h-6 w-auto" alt="GreenCart" />
                                    <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                                        Seller
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
                                    aria-label="Close menu"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Mobile Links */}
                            <div className="p-4 space-y-1.5 overflow-y-auto flex-1">
                                <p className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                    Navigation
                                </p>
                                {sidebarLinks.map((item) => {
                                    const IconComponent = item.icon;
                                    return (
                                        <NavLink
                                            to={item.path}
                                            key={item.name}
                                            end={item.exact}
                                            onClick={() => setMobileMenuOpen(false)}
                                            className={({ isActive }) => {
                                                const active = isItemActive(item.path, isActive);
                                                return `flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-colors ${
                                                    active
                                                        ? "bg-emerald-50 text-emerald-800 font-semibold border-l-4 border-emerald-600"
                                                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                                }`;
                                            }}
                                        >
                                            {({ isActive }) => {
                                                const active = isItemActive(item.path, isActive);
                                                return (
                                                    <>
                                                        <IconComponent
                                                            className={`w-5 h-5 ${
                                                                active ? "text-emerald-600" : "text-slate-400"
                                                            }`}
                                                        />
                                                        <span>{item.name}</span>
                                                    </>
                                                );
                                            }}
                                        </NavLink>
                                    );
                                })}

                                <div className="pt-4 border-t border-slate-200">
                                    <Link
                                        to="/"
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                    >
                                        <ExternalLink className="w-5 h-5 text-slate-400" />
                                        <span>View Public Store</span>
                                    </Link>
                                </div>
                            </div>

                            {/* Mobile Drawer Logout */}
                            <div className="p-4 border-t border-slate-200 bg-slate-50">
                                <button
                                    type="button"
                                    onClick={logout}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium text-rose-600 bg-rose-50 hover:bg-rose-100/80 transition-colors"
                                >
                                    <LogOut className="w-4 h-4" />
                                    <span>Sign Out</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Content Viewport */}
                <main className="flex-1 min-w-0 bg-slate-50/70 overflow-y-auto h-[calc(100vh-64px)]">
                    <div className="w-full">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default SellerLayout;
