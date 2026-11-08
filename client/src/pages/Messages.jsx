import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { assets } from '../assets/assets';
import toast from 'react-hot-toast';

const POLL_INTERVAL_MS = 3500;
const MAX_MESSAGE_LENGTH = 2000;

const formatMessageTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatConversationDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const Messages = () => {
    const { user, setShowUserLogin, axios, currency } = useAppContext();
    const [searchParams, setSearchParams] = useSearchParams();
    const targetConversationId = searchParams.get('id') || searchParams.get('conversationId');

    const [conversations, setConversations] = useState([]);
    const [activeConversationId, setActiveConversationId] = useState(targetConversationId || null);
    const [activeConversation, setActiveConversation] = useState(null);
    const [messages, setMessages] = useState([]);

    const [loadingConversations, setLoadingConversations] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sending, setSending] = useState(false);
    const [inputText, setInputText] = useState('');
    const [fetchError, setFetchError] = useState(null);

    const isMountedRef = useRef(true);
    const isPollingRef = useRef(false);
    const messagesEndRef = useRef(null);
    const activeConvIdRef = useRef(activeConversationId);
    activeConvIdRef.current = activeConversationId;

    // Scroll to bottom of message list
    const scrollToBottom = (behavior = 'smooth') => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior });
        }
    };

    // 1. Fetch Customer Conversations
    const fetchConversations = useCallback(async (isSilent = false) => {
        if (!user) return;
        if (!isSilent) {
            setLoadingConversations(true);
            setFetchError(null);
        }
        try {
            const { data } = await axios.get('/api/chat/customer/conversations?limit=50');
            if (!isMountedRef.current) return;
            if (data.success) {
                const list = data.conversations || [];
                setConversations(list);

                // Auto-select conversation if query param specified or if none selected yet
                if (activeConvIdRef.current) {
                    const match = list.find((c) => c._id === activeConvIdRef.current);
                    if (match) setActiveConversation(match);
                } else if (list.length > 0 && !activeConvIdRef.current) {
                    setActiveConversationId(list[0]._id);
                    setActiveConversation(list[0]);
                }
            } else if (!isSilent) {
                setFetchError(data.message || 'Failed to load conversations');
            }
        } catch (err) {
            if (!isMountedRef.current) return;
            if (!isSilent) {
                const msg = err.response?.data?.message || err.message || 'Failed to load conversations';
                setFetchError(msg);
            }
        } finally {
            if (!isSilent && isMountedRef.current) {
                setLoadingConversations(false);
            }
        }
    }, [user, axios]);

    // 2. Mark Conversation as Read
    const markAsRead = useCallback(async (convId) => {
        if (!convId) return;
        try {
            await axios.post(`/api/chat/customer/conversations/${convId}/read`);
            if (!isMountedRef.current) return;
            // Clear unread count locally in list
            setConversations((prev) =>
                prev.map((c) => (c._id === convId ? { ...c, unreadCountCustomer: 0 } : c))
            );
            setActiveConversation((prev) => (prev?._id === convId ? { ...prev, unreadCountCustomer: 0 } : prev));
        } catch (err) {
            // Non-critical background sync error
            console.error('Failed to mark conversation as read:', err.message);
        }
    }, [axios]);

    // 3. Fetch Messages for Active Conversation
    const fetchMessages = useCallback(async (convId, isSilent = false) => {
        if (!convId || !user) return;
        if (!isSilent) {
            setLoadingMessages(true);
        }
        try {
            const { data } = await axios.get(`/api/chat/customer/conversations/${convId}/messages?limit=50`);
            if (!isMountedRef.current) return;
            if (data.success) {
                setMessages(data.messages || []);
                if (data.conversation) {
                    setActiveConversation(data.conversation);
                }
                // Mark conversation as read if customer has unread messages
                if (data.conversation?.unreadCountCustomer > 0) {
                    markAsRead(convId);
                }
                if (!isSilent) {
                    setTimeout(() => scrollToBottom('auto'), 50);
                }
            }
        } catch (err) {
            if (!isMountedRef.current) return;
            if (!isSilent) {
                const msg = err.response?.data?.message || err.message || 'Failed to load messages';
                toast.error(msg);
            }
        } finally {
            if (!isSilent && isMountedRef.current) {
                setLoadingMessages(false);
            }
        }
    }, [user, axios, markAsRead]);

    // Initialize conversation fetch on mount
    useEffect(() => {
        isMountedRef.current = true;
        if (user) {
            fetchConversations();
        } else {
            setLoadingConversations(false);
        }
        return () => {
            isMountedRef.current = false;
        };
    }, [user, fetchConversations]);

    // Handle query param target conversation change
    useEffect(() => {
        if (targetConversationId && targetConversationId !== activeConversationId) {
            setActiveConversationId(targetConversationId);
        }
    }, [targetConversationId, activeConversationId]);

    // Load messages whenever activeConversationId changes
    useEffect(() => {
        if (activeConversationId) {
            fetchMessages(activeConversationId, false);
        } else {
            setMessages([]);
        }
    }, [activeConversationId, fetchMessages]);

    // 4. Polling Mechanism (Every 3.5 seconds, paused when tab is hidden or unmounted)
    useEffect(() => {
        if (!user) return;

        const pollTick = async () => {
            if (document.hidden || isPollingRef.current || !isMountedRef.current) {
                return;
            }
            isPollingRef.current = true;
            try {
                // Poll conversations list
                await fetchConversations(true);
                // Poll active conversation messages
                if (activeConvIdRef.current) {
                    await fetchMessages(activeConvIdRef.current, true);
                }
            } catch (err) {
                console.error('Polling error:', err.message);
            } finally {
                isPollingRef.current = false;
            }
        };

        const intervalId = setInterval(pollTick, POLL_INTERVAL_MS);

        // Visibility change listener: resume immediately on tab focus
        const handleVisibilityChange = () => {
            if (!document.hidden && isMountedRef.current) {
                pollTick();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [user, fetchConversations, fetchMessages]);

    // 5. Send Customer Message
    const handleSendMessage = async (e) => {
        e?.preventDefault();
        const textToSend = inputText.trim();
        if (!textToSend || sending || !activeConversationId) return;

        if (textToSend.length > MAX_MESSAGE_LENGTH) {
            toast.error(`Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`);
            return;
        }

        setSending(true);
        try {
            const { data } = await axios.post(
                `/api/chat/customer/conversations/${activeConversationId}/messages`,
                { text: textToSend }
            );

            if (data.success && data.message) {
                setInputText('');
                // Append message locally for snappy response
                setMessages((prev) => [...prev, data.message]);
                // Update conversation's last message in conversation list
                setConversations((prev) =>
                    prev.map((c) =>
                        c._id === activeConversationId
                            ? { ...c, lastMessage: textToSend, lastMessageAt: new Date() }
                            : c
                    )
                );
                setTimeout(() => scrollToBottom('smooth'), 50);
            } else {
                toast.error(data.message || 'Failed to send message');
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to send message';
            toast.error(msg);
        } finally {
            if (isMountedRef.current) {
                setSending(false);
            }
        }
    };

    // Selecting a conversation from the sidebar
    const handleSelectConversation = (conv) => {
        if (conv._id === activeConversationId) return;
        setActiveConversationId(conv._id);
        setActiveConversation(conv);
        setSearchParams({ id: conv._id });
        if (conv.unreadCountCustomer > 0) {
            markAsRead(conv._id);
        }
    };

    // Unauthenticated State View
    if (!user) {
        return (
            <div className="mt-16 text-center max-w-md mx-auto py-12 px-6 border border-gray-200 rounded-xl bg-gray-50/50 shadow-sm">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                </div>
                <h2 className="text-2xl font-medium text-gray-800 mb-2">Customer Messages</h2>
                <p className="text-gray-500 text-sm mb-6">
                    Please log in to your GreenCart account to chat with seller support and view your inquiries.
                </p>
                <button
                    onClick={() => setShowUserLogin(true)}
                    className="px-8 py-2.5 bg-primary hover:bg-primary-dull text-white rounded-full font-medium transition cursor-pointer text-sm"
                >
                    Log In to View Messages
                </button>
            </div>
        );
    }

    // Main Layout: Split Screen (Conversations List + Chat Thread)
    return (
        <div className="mt-6 mb-16">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-800">Support & Product Inquiries</h1>
                    <p className="text-xs text-gray-500 mt-0.5">Chat directly with the GreenCart seller team</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden min-h-[580px] h-[75vh] max-h-[820px]">
                {/* ----------------- LEFT: CONVERSATION LIST (4 cols) ----------------- */}
                <div className="md:col-span-5 lg:col-span-4 border-r border-gray-200 flex flex-col h-full bg-gray-50/40">
                    <div className="p-3.5 border-b border-gray-200 bg-white flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Conversations</span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            {conversations.length} total
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                        {loadingConversations ? (
                            <div className="p-6 text-center text-sm text-gray-400 space-y-3">
                                <div className="h-12 bg-gray-200 rounded-lg animate-pulse"></div>
                                <div className="h-12 bg-gray-200 rounded-lg animate-pulse"></div>
                                <div className="h-12 bg-gray-200 rounded-lg animate-pulse"></div>
                            </div>
                        ) : fetchError ? (
                            <div className="p-6 text-center">
                                <p className="text-xs text-red-600 mb-3">{fetchError}</p>
                                <button
                                    onClick={() => fetchConversations()}
                                    className="px-4 py-1.5 text-xs bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 transition"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : conversations.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">
                                <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                    </svg>
                                </div>
                                <p className="text-sm font-medium text-gray-600">No conversations yet</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    Visit any product page and click "Message Seller" to start an inquiry.
                                </p>
                            </div>
                        ) : (
                            conversations.map((conv) => {
                                const isSelected = conv._id === activeConversationId;
                                const hasUnread = conv.unreadCountCustomer > 0;
                                const prod = conv.productId;

                                return (
                                    <div
                                        key={conv._id}
                                        onClick={() => handleSelectConversation(conv)}
                                        className={`p-3.5 flex items-start gap-3 cursor-pointer transition ${
                                            isSelected
                                                ? 'bg-primary/10 border-l-4 border-primary'
                                                : 'hover:bg-gray-100/70 bg-white'
                                        }`}
                                    >
                                        {/* Product Thumbnail or Support Icon */}
                                        <div className="w-11 h-11 rounded-lg border border-gray-200 bg-white flex-shrink-0 overflow-hidden flex items-center justify-center">
                                            {prod?.image?.[0] ? (
                                                <img
                                                    src={prod.image[0]}
                                                    alt={prod.name || 'Product'}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <img src={assets.logo} alt="GreenCart Support" className="w-7 h-7 object-contain opacity-75" />
                                            )}
                                        </div>

                                        {/* Conversation Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-1">
                                                <h4 className="text-xs font-semibold text-gray-800 truncate">
                                                    {prod?.name || 'General Support Inquiry'}
                                                </h4>
                                                <span className="text-[10px] text-gray-400 flex-shrink-0">
                                                    {formatConversationDate(conv.lastMessageAt || conv.updatedAt)}
                                                </span>
                                            </div>

                                            {prod?.offerPrice && (
                                                <p className="text-[11px] text-primary font-medium mt-0.5">
                                                    {currency}{prod.offerPrice}
                                                </p>
                                            )}

                                            <div className="flex items-center justify-between gap-2 mt-1">
                                                <p className={`text-xs truncate ${hasUnread ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                                                    {conv.lastMessage || 'No messages yet'}
                                                </p>
                                                {hasUnread && (
                                                    <span className="px-1.5 py-0.5 text-[10px] font-bold text-white bg-primary rounded-full min-w-4 text-center">
                                                        {conv.unreadCountCustomer}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* ----------------- RIGHT: CHAT THREAD (8 cols) ----------------- */}
                <div className="md:col-span-7 lg:col-span-8 flex flex-col h-full bg-white">
                    {activeConversation ? (
                        <>
                            {/* Chat Header with Product Information */}
                            <div className="p-3.5 border-b border-gray-200 bg-white flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-lg border border-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center bg-gray-50">
                                        {activeConversation.productId?.image?.[0] ? (
                                            <img
                                                src={activeConversation.productId.image[0]}
                                                alt={activeConversation.productId.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <img src={assets.logo} alt="GreenCart" className="w-6 h-6 object-contain" />
                                        )}
                                    </div>
                                    <div className="truncate">
                                        <h3 className="text-sm font-semibold text-gray-800 truncate">
                                            {activeConversation.productId?.name || 'GreenCart Customer Support'}
                                        </h3>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                                            <span>Seller Support</span>
                                            {activeConversation.productId?.offerPrice && (
                                                <span className="text-primary font-medium">
                                                    • {currency}{activeConversation.productId.offerPrice}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {activeConversation.productId?._id && (
                                    <Link
                                        to={`/products/${activeConversation.productId.category || 'all'}/${activeConversation.productId._id}`}
                                        className="text-xs text-primary border border-primary/30 hover:bg-primary/5 px-3 py-1.5 rounded-full font-medium transition flex-shrink-0"
                                    >
                                        View Product
                                    </Link>
                                )}
                            </div>

                            {/* Message History Area */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fbfbfb]">
                                {loadingMessages ? (
                                    <div className="flex items-center justify-center h-full text-xs text-gray-400">
                                        Loading message history...
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                                        <p className="text-sm font-medium text-gray-600">Start the conversation</p>
                                        <p className="text-xs text-gray-400 mt-1 max-w-xs">
                                            Send a message below. The GreenCart seller team will receive and reply to your inquiry.
                                        </p>
                                    </div>
                                ) : (
                                    messages.map((msg) => {
                                        const isCustomer = msg.senderRole === 'customer';

                                        return (
                                            <div
                                                key={msg._id}
                                                className={`flex flex-col ${isCustomer ? 'items-end' : 'items-start'}`}
                                            >
                                                <div className="flex items-end gap-1.5 max-w-[80%]">
                                                    <div
                                                        className={`px-4 py-2.5 rounded-2xl text-sm shadow-xs break-words whitespace-pre-wrap leading-relaxed ${
                                                            isCustomer
                                                                ? 'bg-primary text-white rounded-br-xs'
                                                                : 'bg-white border border-gray-200 text-gray-800 rounded-bl-xs'
                                                        }`}
                                                    >
                                                        {msg.text}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-1 px-1">
                                                    <span className="text-[10px] text-gray-400">
                                                        {formatMessageTime(msg.createdAt)}
                                                    </span>
                                                    {isCustomer && (
                                                        <span className="text-[10px] text-gray-400">
                                                            {msg.read ? '• Read' : '• Sent'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input Form */}
                            <form
                                onSubmit={handleSendMessage}
                                className="p-3 border-t border-gray-200 bg-white flex items-center gap-2"
                            >
                                <input
                                    type="text"
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    placeholder="Type your message to seller..."
                                    maxLength={MAX_MESSAGE_LENGTH}
                                    disabled={sending}
                                    className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-full focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:bg-gray-100 transition"
                                />
                                <button
                                    type="submit"
                                    disabled={sending || !inputText.trim()}
                                    className="px-5 py-2.5 bg-primary hover:bg-primary-dull text-white text-sm font-medium rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 flex-shrink-0"
                                >
                                    {sending ? (
                                        <span>Sending...</span>
                                    ) : (
                                        <>
                                            <span>Send</span>
                                            <svg className="w-3.5 h-3.5 transform rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                            </svg>
                                        </>
                                    )}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center p-8 text-gray-400">
                            <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </div>
                            <h3 className="text-base font-medium text-gray-700">No conversation selected</h3>
                            <p className="text-xs text-gray-400 mt-1 max-w-sm">
                                Choose a conversation from the left to view messages and reply, or message the seller from any product page.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Messages;
