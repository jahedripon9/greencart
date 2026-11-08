import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    MessageSquare,
    Search,
    Send,
    X,
    ChevronLeft,
    Package,
    Clock,
    RefreshCw
} from '../../components/seller/SellerIcons';

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
    const { axios, currency } = useAppContext();
    const [searchParams, setSearchParams] = useSearchParams();
    const targetConversationId = searchParams.get('id') || searchParams.get('conversationId');

    const [conversations, setConversations] = useState([]);
    const [filteredConversations, setFilteredConversations] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

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

    const scrollToBottom = (behavior = 'smooth') => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior });
        }
    };

    // 1. Mark Conversation as Read (Seller side)
    const markAsRead = useCallback(async (convId) => {
        if (!convId) return;
        try {
            await axios.post(`/api/chat/seller/conversations/${convId}/read`);
            if (!isMountedRef.current) return;
            setConversations((prev) =>
                prev.map((c) => (c._id === convId ? { ...c, unreadCountSeller: 0 } : c))
            );
            setActiveConversation((prev) => (prev?._id === convId ? { ...prev, unreadCountSeller: 0 } : prev));
        } catch (err) {
            console.error('Failed to mark conversation as read:', err.message);
        }
    }, [axios]);

    // 2. Fetch Seller Conversations
    const fetchConversations = useCallback(async (isSilent = false) => {
        if (!isSilent) {
            setLoadingConversations(true);
            setFetchError(null);
        }
        try {
            const { data } = await axios.get('/api/chat/seller/conversations?limit=50');
            if (!isMountedRef.current) return;
            if (data.success) {
                const list = data.conversations || [];
                setConversations(list);

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
    }, [axios]);

    // 3. Fetch Messages for Selected Conversation
    const fetchMessages = useCallback(async (convId, isSilent = false) => {
        if (!convId) return;
        if (!isSilent) {
            setLoadingMessages(true);
        }
        try {
            const { data } = await axios.get(`/api/chat/seller/conversations/${convId}/messages?limit=50`);
            if (!isMountedRef.current) return;
            if (data.success) {
                setMessages(data.messages || []);
                if (data.conversation) {
                    setActiveConversation(data.conversation);
                }
                if (data.conversation?.unreadCountSeller > 0) {
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
    }, [axios, markAsRead]);

    // Filter conversations by search term
    useEffect(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) {
            setFilteredConversations(conversations);
            return;
        }

        const filtered = conversations.filter((c) => {
            const customerName = c.customerId?.name?.toLowerCase() || '';
            const customerEmail = c.customerId?.email?.toLowerCase() || '';
            const productName = c.productId?.name?.toLowerCase() || '';
            const lastMsg = c.lastMessage?.toLowerCase() || '';
            return (
                customerName.includes(term) ||
                customerEmail.includes(term) ||
                productName.includes(term) ||
                lastMsg.includes(term)
            );
        });
        setFilteredConversations(filtered);
    }, [searchTerm, conversations]);

    // Initial load
    useEffect(() => {
        isMountedRef.current = true;
        fetchConversations();
        return () => {
            isMountedRef.current = false;
        };
    }, [fetchConversations]);

    // Handle query param target conversation
    useEffect(() => {
        if (targetConversationId && targetConversationId !== activeConversationId) {
            setActiveConversationId(targetConversationId);
        }
    }, [targetConversationId, activeConversationId]);

    // Load messages on active conversation change
    useEffect(() => {
        if (activeConversationId) {
            fetchMessages(activeConversationId, false);
        } else {
            setMessages([]);
        }
    }, [activeConversationId, fetchMessages]);

    // 4. Polling Mechanism (Every 3.5 seconds, paused when tab hidden or unmounted)
    useEffect(() => {
        const pollTick = async () => {
            if (document.hidden || isPollingRef.current || !isMountedRef.current) {
                return;
            }
            isPollingRef.current = true;
            try {
                await fetchConversations(true);
                if (activeConvIdRef.current) {
                    await fetchMessages(activeConvIdRef.current, true);
                }
            } catch (err) {
                console.error('Seller polling error:', err.message);
            } finally {
                isPollingRef.current = false;
            }
        };

        const intervalId = setInterval(pollTick, POLL_INTERVAL_MS);

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
    }, [fetchConversations, fetchMessages]);

    // 5. Send Seller Reply
    const handleSendReply = async (e) => {
        e?.preventDefault();
        const textToSend = inputText.trim();
        if (!textToSend || sending || !activeConversationId) return;

        if (textToSend.length > MAX_MESSAGE_LENGTH) {
            toast.error(`Reply cannot exceed ${MAX_MESSAGE_LENGTH} characters`);
            return;
        }

        setSending(true);
        try {
            const { data } = await axios.post(
                `/api/chat/seller/conversations/${activeConversationId}/messages`,
                { text: textToSend }
            );

            if (data.success && data.message) {
                setInputText('');
                setMessages((prev) => [...prev, data.message]);
                setConversations((prev) =>
                    prev.map((c) =>
                        c._id === activeConversationId
                            ? { ...c, lastMessage: textToSend, lastMessageAt: new Date() }
                            : c
                    )
                );
                setTimeout(() => scrollToBottom('smooth'), 50);
            } else {
                toast.error(data.message || 'Failed to send reply');
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to send reply';
            toast.error(msg);
        } finally {
            if (isMountedRef.current) {
                setSending(false);
            }
        }
    };

    const handleSelectConversation = (conv) => {
        if (conv._id === activeConversationId) return;
        setActiveConversationId(conv._id);
        setActiveConversation(conv);
        setSearchParams({ id: conv._id });
        if (conv.unreadCountSeller > 0) {
            markAsRead(conv._id);
        }
    };

    const totalUnreadAll = conversations.reduce((acc, c) => acc + (c.unreadCountSeller || 0), 0);

    return (
        <div className="flex-1 h-[95vh] flex flex-col overflow-hidden bg-slate-50">
            {/* Top Bar */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
                        <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Customer Inquiries</h1>
                            <span className="text-xs text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full font-medium">
                                {conversations.length} total
                            </span>
                            {totalUnreadAll > 0 && (
                                <span className="text-xs text-white bg-emerald-600 px-2.5 py-0.5 rounded-full font-bold shadow-xs">
                                    {totalUnreadAll} unread
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">Communicate directly with customers inquiring about your products.</p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => fetchConversations()}
                    disabled={loadingConversations}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-300 shadow-xs transition cursor-pointer"
                    title="Refresh conversations"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingConversations ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
                    <span className="hidden sm:inline">Refresh</span>
                </button>
            </div>

            {/* Split Screen Container */}
            <div className="flex-1 flex overflow-hidden">
                {/* ----------------- LEFT: CONVERSATION LIST (Sidebar) ----------------- */}
                <div
                    className={`${
                        activeConversationId ? 'hidden md:flex' : 'flex'
                    } w-full md:w-80 lg:w-96 border-r border-slate-200 flex-col h-full bg-white flex-shrink-0`}
                >
                    {/* Search Field */}
                    <div className="p-3.5 border-b border-slate-200 bg-white">
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search customer or product..."
                                className="w-full pl-9 pr-7 py-2 text-xs bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 transition text-slate-800 placeholder:text-slate-400"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Conversations List */}
                    <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                        {loadingConversations ? (
                            <div className="p-4 space-y-3">
                                <div className="h-16 bg-slate-100 rounded-xl animate-pulse"></div>
                                <div className="h-16 bg-slate-100 rounded-xl animate-pulse"></div>
                                <div className="h-16 bg-slate-100 rounded-xl animate-pulse"></div>
                            </div>
                        ) : fetchError ? (
                            <div className="p-6 text-center">
                                <p className="text-xs text-rose-600 mb-3">{fetchError}</p>
                                <button
                                    onClick={() => fetchConversations()}
                                    className="px-4 py-1.5 text-xs bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : filteredConversations.length === 0 ? (
                            <div className="p-8 text-center text-slate-400">
                                <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-2.5">
                                    <MessageSquare className="w-6 h-6" />
                                </div>
                                <p className="text-xs font-semibold text-slate-700">
                                    {searchTerm ? 'No matching inquiries' : 'No inquiries yet'}
                                </p>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                    {searchTerm ? 'Try a different search term.' : 'Customer product inquiries will appear here.'}
                                </p>
                            </div>
                        ) : (
                            filteredConversations.map((conv) => {
                                const isSelected = conv._id === activeConversationId;
                                const hasUnread = conv.unreadCountSeller > 0;
                                const customerName = conv.customerId?.name || 'Customer';
                                const customerEmail = conv.customerId?.email || '';
                                const prod = conv.productId;

                                return (
                                    <div
                                        key={conv._id}
                                        onClick={() => handleSelectConversation(conv)}
                                        className={`p-3.5 flex items-start gap-3 cursor-pointer transition border-l-3 ${
                                            isSelected
                                                ? 'bg-emerald-50/70 border-emerald-600'
                                                : 'border-transparent hover:bg-slate-50 bg-white'
                                        }`}
                                    >
                                        {/* Product Thumbnail or User Avatar */}
                                        <div className="w-10 h-10 rounded-xl border border-slate-200 bg-white flex-shrink-0 overflow-hidden flex items-center justify-center shadow-xs">
                                            {prod?.image?.[0] ? (
                                                <img
                                                    src={prod.image[0]}
                                                    alt={prod.name || 'Product'}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center text-xs">
                                                    {customerName.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>

                                        {/* Text Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-1">
                                                <h4 className="text-xs font-bold text-slate-900 truncate">
                                                    {customerName}
                                                </h4>
                                                <span className="text-[10px] text-slate-400 flex-shrink-0">
                                                    {formatConversationDate(conv.lastMessageAt || conv.updatedAt)}
                                                </span>
                                            </div>

                                            {customerEmail && (
                                                <p className="text-[10px] text-slate-400 truncate">{customerEmail}</p>
                                            )}

                                            {prod?.name && (
                                                <p className="text-[11px] text-emerald-700 font-medium truncate mt-0.5">
                                                    Re: {prod.name}
                                                </p>
                                            )}

                                            <div className="flex items-center justify-between gap-2 mt-1">
                                                <p
                                                    className={`text-xs truncate ${
                                                        hasUnread ? 'font-bold text-slate-900' : 'text-slate-500'
                                                    }`}
                                                >
                                                    {conv.lastMessage || 'No messages yet'}
                                                </p>
                                                {hasUnread && (
                                                    <span className="px-1.5 py-0.2 text-[10px] font-bold text-white bg-emerald-600 rounded-full min-w-4.5 text-center shadow-xs">
                                                        {conv.unreadCountSeller}
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

                {/* ----------------- RIGHT: ACTIVE CHAT PANEL ----------------- */}
                <div
                    className={`${
                        activeConversationId ? 'flex' : 'hidden md:flex'
                    } flex-1 flex-col h-full bg-white`}
                >
                    {activeConversation ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-3.5 px-5 border-b border-slate-200 bg-white flex items-center justify-between gap-3 flex-shrink-0">
                                <div className="flex items-center gap-3 min-w-0">
                                    {/* Mobile Back Button */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveConversationId(null);
                                            setActiveConversation(null);
                                        }}
                                        className="md:hidden text-slate-500 hover:text-slate-800 p-1 -ml-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>

                                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center text-sm flex-shrink-0 border border-emerald-100">
                                        {(activeConversation.customerId?.name || 'C').charAt(0).toUpperCase()}
                                    </div>

                                    <div className="truncate">
                                        <h3 className="text-sm font-bold text-slate-900 truncate">
                                            {activeConversation.customerId?.name || 'Customer'}
                                        </h3>
                                        <p className="text-xs text-slate-500 truncate">
                                            {activeConversation.customerId?.email || 'Registered Customer'}
                                        </p>
                                    </div>
                                </div>

                                {activeConversation.productId && (
                                    <div className="flex items-center gap-2 border border-slate-200 rounded-xl p-1.5 bg-slate-50 max-w-xs truncate flex-shrink-0">
                                        {activeConversation.productId.image?.[0] && (
                                            <img
                                                src={activeConversation.productId.image[0]}
                                                alt={activeConversation.productId.name}
                                                className="w-8 h-8 rounded-lg object-cover border border-slate-200 bg-white shrink-0"
                                            />
                                        )}
                                        <div className="truncate text-left text-xs">
                                            <p className="font-semibold text-slate-800 truncate max-w-[140px]">
                                                {activeConversation.productId.name}
                                            </p>
                                            {activeConversation.productId.offerPrice && (
                                                <p className="text-emerald-700 font-bold text-[11px]">
                                                    {currency}{activeConversation.productId.offerPrice}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Message History Area */}
                            <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50/60">
                                {loadingMessages ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-2 text-xs text-slate-400">
                                        <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                                        <span>Loading conversation thread...</span>
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
                                        <p className="text-sm font-bold text-slate-700">No messages in this inquiry</p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Type a message below to reply to this customer.
                                        </p>
                                    </div>
                                ) : (
                                    messages.map((msg) => {
                                        const isSeller = msg.senderRole === 'seller';

                                        return (
                                            <div
                                                key={msg._id}
                                                className={`flex flex-col ${isSeller ? 'items-end' : 'items-start'}`}
                                            >
                                                <div className="flex items-end gap-1.5 max-w-[80%]">
                                                    <div
                                                        className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm shadow-xs break-words whitespace-pre-wrap leading-relaxed ${
                                                            isSeller
                                                                ? 'bg-emerald-600 text-white rounded-br-xs'
                                                                : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs'
                                                        }`}
                                                    >
                                                        {msg.text}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px] text-slate-400">
                                                    <span>{isSeller ? 'You' : (activeConversation.customerId?.name || 'Customer')}</span>
                                                    <span>•</span>
                                                    <span>{formatMessageTime(msg.createdAt)}</span>
                                                    {isSeller && (
                                                        <>
                                                            <span>•</span>
                                                            <span className={msg.read ? 'text-emerald-600 font-semibold' : ''}>
                                                                {msg.read ? 'Seen' : 'Delivered'}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Reply Form */}
                            <form
                                onSubmit={handleSendReply}
                                className="p-3 px-5 border-t border-slate-200 bg-white flex items-center gap-2.5 flex-shrink-0"
                            >
                                <input
                                    type="text"
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    placeholder="Write a reply to the customer..."
                                    maxLength={MAX_MESSAGE_LENGTH}
                                    disabled={sending}
                                    className="flex-1 px-4 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 disabled:bg-slate-100 transition text-slate-800"
                                />
                                <button
                                    type="submit"
                                    disabled={sending || !inputText.trim()}
                                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold rounded-xl shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 flex-shrink-0"
                                >
                                    {sending ? (
                                        <span>Sending...</span>
                                    ) : (
                                        <>
                                            <span>Reply</span>
                                            <Send className="w-3.5 h-3.5" />
                                        </>
                                    )}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center p-8 text-slate-400">
                            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mb-3">
                                <MessageSquare className="w-8 h-8" />
                            </div>
                            <h3 className="text-base font-bold text-slate-800">Select an inquiry to view</h3>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm">
                                Choose a customer conversation from the list to read inquiries and send replies.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Messages;
