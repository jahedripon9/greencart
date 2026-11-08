import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { assets } from '../../assets/assets';
import toast from 'react-hot-toast';
import { Mail, Eye, EyeOff, Store, ArrowUpDown, ChevronRight } from './SellerIcons';

const SellerLogin = () => {
    const { isSeller, setIsSeller, setSellerUser, navigate, axios } = useAppContext();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const onSubmitHandler = async (event) => {
        event.preventDefault();
        if (isLoading) return;

        setIsLoading(true);
        try {
            const { data } = await axios.post('/api/seller/login', { email, password });
            if (data.success) {
                toast.success(data.message || "Login successful!");
                setIsSeller(true);
                if (data.user) {
                    setSellerUser(data.user);
                }
                navigate("/seller");
            } else {
                toast.error(data.message || "Invalid credentials");
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message || "Login failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isSeller) {
            navigate("/seller");
        }
    }, [isSeller, navigate]);

    if (isSeller) return null;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                <Link to="/" className="inline-block transition-transform hover:scale-102">
                    <img src={assets.logo} alt="GreenCart" className="h-9 w-auto mx-auto object-contain" />
                </Link>
                <div className="mt-3 flex items-center justify-center gap-1.5">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Store className="w-3.5 h-3.5 text-emerald-600" />
                        Merchant Portal
                    </span>
                </div>
                <h2 className="mt-3 text-2xl font-bold text-slate-900 tracking-tight">
                    Sign in to your Dashboard
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                    Manage store catalog, stock quantities, and customer orders.
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-6 sm:px-10 rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-200/80">
                    <form onSubmit={onSubmitHandler} className="space-y-5">
                        {/* Email Input */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                                Merchant Email
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                    <Mail className="w-4 h-4" />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="seller@example.com"
                                    required
                                    autoComplete="email"
                                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                                Merchant Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    autoComplete="current-password"
                                    className="block w-full px-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(prev => !prev)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-md shadow-emerald-600/20 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 cursor-pointer ${
                                    isLoading ? "opacity-75 cursor-not-allowed" : ""
                                }`}
                            >
                                {isLoading ? (
                                    <span className="inline-flex items-center gap-2">
                                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                        Signing in...
                                    </span>
                                ) : (
                                    "Sign in to Dashboard"
                                )}
                            </button>
                        </div>
                    </form>

                    <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>Protected merchant area</span>
                        <Link to="/" className="text-emerald-700 hover:text-emerald-800 font-medium hover:underline inline-flex items-center gap-0.5">
                            Customer Store &rarr;
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SellerLogin;
