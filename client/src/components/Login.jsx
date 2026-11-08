import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useSignIn, useSignUp, useAuth } from '@clerk/clerk-react';
import toast from 'react-hot-toast';

const Login = ({ linkingData = null, onCancelLinking = null }) => {
    const { setShowUserLogin, setUser, fetchUser, axios, navigate } = useAppContext();

    // Existing Email/Password Form State
    const [state, setState] = useState("login");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Google Sign-In State
    const { isLoaded: isSignInLoaded, signIn } = useSignIn();
    const { isLoaded: isSignUpLoaded, signUp } = useSignUp();
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);

    // Option B Password Linking State
    const { getToken } = useAuth();
    const [linkPassword, setLinkPassword] = useState("");
    const [isLinking, setIsLinking] = useState(false);

    // -------------------------------------------------------------------------
    // Existing Email/Password Submit Handler (Preserved 100%)
    // -------------------------------------------------------------------------
    const onSubmitHandler = async (event) => {
        try {
            event.preventDefault();
            setIsSubmitting(true);

            const { data } = await axios.post(`/api/user/${state}`, {
                name, email, password
            });
            if (data.success) {
                setUser(data.user);
                if (typeof fetchUser === 'function') {
                    await fetchUser();
                }
                setShowUserLogin(false);
                navigate('/');
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // -------------------------------------------------------------------------
    // Google OAuth Trigger via Supported Clerk v5 SDK
    // -------------------------------------------------------------------------
    const handleGoogleSignIn = async () => {
        const authClient = state === "register" ? (signUp || signIn) : (signIn || signUp);

        if (!authClient) {
            toast.error("Authentication service is initializing. Please try again.");
            return;
        }

        try {
            setIsGoogleLoading(true);
            await authClient.authenticateWithRedirect({
                strategy: 'oauth_google',
                redirectUrl: '/sso-callback',
                redirectUrlComplete: '/',
                continueSignUp: true
            });
        } catch (err) {
            setIsGoogleLoading(false);
            const errMsg = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err.message || "Failed to start Google sign-in";
            toast.error(errMsg);
        }
    };

    // -------------------------------------------------------------------------
    // Option B Account Linking Submit Handler
    // -------------------------------------------------------------------------
    const handleLinkSubmit = async (event) => {
        try {
            event.preventDefault();
            if (!linkPassword || isLinking) return;

            setIsLinking(true);

            // Dynamically retrieve a fresh, unexpired Clerk session token
            let freshToken;
            try {
                freshToken = await getToken();
            } catch (tokenErr) {
                toast.error("Failed to retrieve Google authentication token. Please try again.");
                setIsLinking(false);
                return;
            }

            if (!freshToken || typeof freshToken !== 'string' || !freshToken.trim()) {
                toast.error("Google authentication session has expired. Please sign in again.");
                setIsLinking(false);
                return;
            }

            const { data } = await axios.post('/api/user/clerk/google', {
                clerkToken: freshToken,
                linkPassword
            });

            if (data.success) {
                setUser(data.user);
                if (typeof fetchUser === 'function') {
                    await fetchUser();
                }
                setShowUserLogin(false);
                setLinkPassword("");
                toast.success(data.message || "Account linked successfully with Google");
            } else {
                toast.error(data.message || "Incorrect password. Could not link account.");
                setLinkPassword("");
            }
        } catch (err) {
            const errMsg = err?.response?.data?.message || err.message || "Failed to link account";
            toast.error(errMsg);
            setLinkPassword("");
        } finally {
            setIsLinking(false);
        }
    };

    const handleClose = () => {
        if (linkingData && typeof onCancelLinking === 'function') {
            onCancelLinking();
        } else {
            setShowUserLogin(false);
        }
    };

    // -------------------------------------------------------------------------
    // View 1: Option B Password Challenge (Account Linking)
    // -------------------------------------------------------------------------
    if (linkingData) {
        return (
            <div onClick={handleClose} className='fixed top-0 bottom-0 left-0 right-0 z-30 flex items-center text-sm text-gray-600 bg-black/50'>
                <form onSubmit={handleLinkSubmit} onClick={(e) => e.stopPropagation()} className="flex flex-col gap-4 m-auto items-start p-8 py-10 w-80 sm:w-[368px] rounded-lg shadow-xl border border-gray-200 bg-white">
                    <p className="text-xl font-medium m-auto text-center">
                        <span className="text-primary">Link</span> Google Account
                    </p>
                    <p className="text-xs text-gray-500 text-center w-full leading-relaxed">
                        An account with <strong>{linkingData.email}</strong> already exists. Please enter your existing GreenCart password to link your Google account.
                    </p>

                    <div className="w-full">
                        <p className="text-xs text-gray-500 mb-1">Email</p>
                        <input
                            value={linkingData.email}
                            disabled
                            className="border border-gray-200 rounded w-full p-2 bg-gray-50 text-gray-500 cursor-not-allowed text-sm"
                            type="email"
                        />
                    </div>

                    <div className="w-full">
                        <p className="text-xs text-gray-500 mb-1">GreenCart Password</p>
                        <input
                            onChange={(e) => setLinkPassword(e.target.value)}
                            value={linkPassword}
                            placeholder="Enter existing password"
                            className="border border-gray-200 rounded w-full p-2 outline-primary text-sm"
                            type="password"
                            required
                            autoFocus
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLinking}
                        className="bg-primary hover:bg-primary-dull transition-all text-white w-full py-2.5 rounded-md cursor-pointer disabled:opacity-50 font-medium"
                    >
                        {isLinking ? "Linking Account..." : "Link & Sign In"}
                    </button>

                    <button
                        type="button"
                        onClick={handleClose}
                        className="w-full text-center text-xs text-gray-500 hover:text-gray-700 cursor-pointer pt-1"
                    >
                        Cancel
                    </button>
                </form>
            </div>
        );
    }

    // -------------------------------------------------------------------------
    // View 2: Standard Login / Registration with Google Sign-In Option
    // -------------------------------------------------------------------------
    return (
        <div onClick={handleClose} className='fixed top-0 bottom-0 left-0 right-0 z-30 flex items-center text-sm text-gray-600 bg-black/50'>
            <form onSubmit={onSubmitHandler} onClick={(e) => e.stopPropagation()} className="flex flex-col gap-4 m-auto items-start p-8 py-10 w-80 sm:w-[352px] rounded-lg shadow-xl border border-gray-200 bg-white">
                <p className="text-2xl font-medium m-auto">
                    <span className="text-primary">User</span> {state === "login" ? "Login" : "Sign Up"}
                </p>

                {/* Google Sign-in Button */}
                <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isGoogleLoading || isSubmitting}
                    className="w-full flex items-center justify-center gap-2.5 py-2 px-4 border border-gray-300 rounded-md shadow-xs bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition cursor-pointer disabled:opacity-50 mt-1"
                >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>{isGoogleLoading ? "Connecting to Google..." : "Continue with Google"}</span>
                </button>

                {/* Visual Divider */}
                <div className="w-full flex items-center my-0.5">
                    <div className="flex-grow border-t border-gray-200"></div>
                    <span className="px-3 text-xs text-gray-400 uppercase">or</span>
                    <div className="flex-grow border-t border-gray-200"></div>
                </div>

                {/* Email / Password Form Fields */}
                {state === "register" && (
                    <div className="w-full">
                        <p>Name</p>
                        <input onChange={(e) => setName(e.target.value)} value={name} placeholder="type here" className="border border-gray-200 rounded w-full p-2 mt-1 outline-primary" type="text" required />
                    </div>
                )}
                <div className="w-full ">
                    <p>Email</p>
                    <input onChange={(e) => setEmail(e.target.value)} value={email} placeholder="type here" className="border border-gray-200 rounded w-full p-2 mt-1 outline-primary" type="email" required />
                </div>
                <div className="w-full ">
                    <p>Password</p>
                    <input onChange={(e) => setPassword(e.target.value)} value={password} placeholder="type here" className="border border-gray-200 rounded w-full p-2 mt-1 outline-primary" type="password" required />
                </div>

                {state === "register" ? (
                    <p>
                        Already have account? <span onClick={() => setState("login")} className="text-primary cursor-pointer">click here</span>
                    </p>
                ) : (
                    <p>
                        Create an account? <span onClick={() => setState("register")} className="text-primary cursor-pointer">click here</span>
                    </p>
                )}

                <button disabled={isSubmitting || isGoogleLoading} className="bg-primary hover:bg-primary-dull transition-all text-white w-full py-2 rounded-md cursor-pointer disabled:opacity-50">
                    {isSubmitting ? "Processing..." : (state === "register" ? "Create Account" : "Login")}
                </button>
            </form>
        </div>
    );
};

export default Login;
