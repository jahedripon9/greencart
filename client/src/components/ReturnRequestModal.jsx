import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const ReturnRequestModal = ({
    isOpen,
    onClose,
    order,
    initialProduct = null,
    policy = null,
    onSuccess,
    axios,
    currency = "৳"
}) => {
    const [selectedProductId, setSelectedProductId] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [reason, setReason] = useState('');
    const [customReason, setCustomReason] = useState('');
    const [customerNotes, setCustomerNotes] = useState('');
    const [returnMethod, setReturnMethod] = useState('Pickup');
    const [submitting, setSubmitting] = useState(false);

    const eligibleReasons = policy?.eligibleReasons || [
        "Damaged or defective item received",
        "Wrong product delivered",
        "Expired product received",
        "Missing items from package",
        "Quality not as described",
        "Other (please specify)"
    ];

    useEffect(() => {
        if (isOpen && order) {
            if (initialProduct?._id) {
                setSelectedProductId(String(initialProduct._id));
            } else if (order.items?.[0]) {
                const firstId = order.items[0].product?._id || order.items[0].product;
                setSelectedProductId(String(firstId));
            }
            setQuantity(1);
            setReason(eligibleReasons[0] || "");
            setCustomReason('');
            setCustomerNotes('');
            setReturnMethod('Pickup');
            setSubmitting(false);
        }
    }, [isOpen, order, initialProduct]);

    if (!isOpen || !order) return null;

    const selectedOrderItem = (order.items || []).find(it => {
        const pId = it.product?._id ? String(it.product._id) : String(it.product);
        return pId === selectedProductId;
    });

    const maxQty = selectedOrderItem?.quantity || 1;
    const unitPrice = selectedOrderItem?.unitPrice || selectedOrderItem?.product?.price || 0;
    const calculatedRefund = unitPrice * quantity;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedProductId) {
            toast.error("Please select an item to return");
            return;
        }

        const effectiveReason = reason === "Other (please specify)"
            ? customReason.trim()
            : reason;

        if (!effectiveReason) {
            toast.error("Please provide a return reason");
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                orderId: order._id,
                items: [
                    {
                        productId: selectedProductId,
                        quantity,
                        reason: effectiveReason
                    }
                ],
                customerNotes: customerNotes.trim(),
                returnMethod
            };

            const { data } = await axios.post('/api/returns/request', payload);
            if (data.success) {
                toast.success(data.message || "Return request submitted successfully");
                if (typeof onSuccess === 'function') {
                    onSuccess(data.returnRequest);
                }
                onClose();
            } else {
                toast.error(data.message || "Failed to submit return request");
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || "Failed to submit return request";
            toast.error(errorMsg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity" role="dialog" aria-modal="true">
            <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-primary px-6 py-4 text-white flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold">Request Item Return</h2>
                        <p className="text-xs text-emerald-100">Order #{order.orderNumber || order._id}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition cursor-pointer"
                        aria-label="Close dialog"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                    {/* Item Selection */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                            Select Item to Return
                        </label>
                        <select
                            value={selectedProductId}
                            onChange={(e) => {
                                setSelectedProductId(e.target.value);
                                setQuantity(1);
                            }}
                            className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                            required
                        >
                            {(order.items || []).map((it) => {
                                const itProdId = it.product?._id ? String(it.product._id) : String(it.product);
                                const itName = it.name || it.product?.name || "Product";
                                return (
                                    <option key={itProdId} value={itProdId}>
                                        {itName} (Ordered: {it.quantity}) - {currency}{it.unitPrice || it.product?.price || 0} each
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    {/* Quantity Picker */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                                Return Quantity
                            </label>
                            <input
                                type="number"
                                min="1"
                                max={maxQty}
                                value={quantity}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    if (Number.isInteger(val)) {
                                        setQuantity(Math.max(1, Math.min(val, maxQty)));
                                    }
                                }}
                                className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                                required
                            />
                            <p className="text-[11px] text-gray-400 mt-0.5">Max available: {maxQty}</p>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                                Estimated Refund
                            </label>
                            <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-bold text-base">
                                {currency}{calculatedRefund.toLocaleString()}
                            </div>
                        </div>
                    </div>

                    {/* Reason Selection */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                            Reason for Return
                        </label>
                        <select
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                            required
                        >
                            {eligibleReasons.map((r, idx) => (
                                <option key={idx} value={r}>{r}</option>
                            ))}
                        </select>
                    </div>

                    {reason === "Other (please specify)" && (
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                                Specific Reason Details
                            </label>
                            <input
                                type="text"
                                value={customReason}
                                onChange={(e) => setCustomReason(e.target.value)}
                                placeholder="Explain why you are returning this item"
                                className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                                required
                            />
                        </div>
                    )}

                    {/* Return Method */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                            Collection Method
                        </label>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition ${returnMethod === 'Pickup' ? 'border-primary bg-primary/5 font-semibold text-primary' : 'border-gray-200 text-gray-600'}`}>
                                <input
                                    type="radio"
                                    name="returnMethod"
                                    value="Pickup"
                                    checked={returnMethod === 'Pickup'}
                                    onChange={() => setReturnMethod('Pickup')}
                                    className="text-primary focus:ring-primary"
                                />
                                <span>Free Doorstep Pickup</span>
                            </label>
                            <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition ${returnMethod === 'Drop-off' ? 'border-primary bg-primary/5 font-semibold text-primary' : 'border-gray-200 text-gray-600'}`}>
                                <input
                                    type="radio"
                                    name="returnMethod"
                                    value="Drop-off"
                                    checked={returnMethod === 'Drop-off'}
                                    onChange={() => setReturnMethod('Drop-off')}
                                    className="text-primary focus:ring-primary"
                                />
                                <span>Hub Drop-off</span>
                            </label>
                        </div>
                    </div>

                    {/* Customer Notes */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                            Additional Notes / Description (Optional)
                        </label>
                        <textarea
                            rows={3}
                            value={customerNotes}
                            onChange={(e) => setCustomerNotes(e.target.value)}
                            placeholder="Provide any additional details regarding item condition or collection instructions"
                            className="w-full text-sm border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>

                    {/* Policy Link Note */}
                    <p className="text-xs text-gray-500 pt-1">
                        By submitting, you agree to GreenCart's{' '}
                        <Link to="/return-policy" target="_blank" className="text-primary hover:underline font-medium">
                            Return & Refund Policy
                        </Link>.
                    </p>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-medium transition cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-dull text-white text-sm font-bold shadow-md transition transform active:scale-98 disabled:opacity-50 cursor-pointer"
                        >
                            {submitting ? "Submitting..." : "Submit Return Request"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ReturnRequestModal;
