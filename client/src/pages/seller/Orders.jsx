import React, { useEffect, useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { assets } from '../../assets/assets';
import toast from 'react-hot-toast';
import {
  ShoppingBag,
  Package,
  Clock,
  MapPin,
  Phone,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Filter
} from '../../components/seller/SellerIcons';

const STATUS_OPTIONS = [
  "Order Placed",
  "Packing",
  "Shipped",
  "Out for Delivery",
  "Delivered",
  "Cancelled"
];

const Orders = () => {
  const { currency, axios } = useAppContext();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get('/api/order/seller');
      if (data.success) {
        setOrders(data.orders);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [axios]);

  const handleStatusUpdate = async (orderId, newStatus) => {
    setUpdatingOrderId(orderId);
    try {
      const { data } = await axios.post('/api/order/status', {
        orderId,
        status: newStatus
      });

      if (data.success) {
        toast.success(data.message || "Order status updated");
        setOrders((prev) =>
          prev.map((order) =>
            order._id === orderId ? { ...order, status: newStatus } : order
          )
        );
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handlePaymentUpdate = async (orderId, isPaidValue) => {
    setUpdatingOrderId(`${orderId}-pay`);
    try {
      const { data } = await axios.post('/api/order/status', {
        orderId,
        isPaid: isPaidValue
      });

      if (data.success) {
        toast.success(data.message || "Payment status updated");
        setOrders((prev) =>
          prev.map((order) =>
            order._id === orderId ? { ...order, isPaid: isPaidValue } : order
          )
        );
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "Order Placed":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "Packing":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "Shipped":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "Out for Delivery":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "Delivered":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Cancelled":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Filter by tab
      if (statusFilter === 'ACTIVE') {
        if (order.status === 'Delivered' || order.status === 'Cancelled') return false;
      } else if (statusFilter === 'DELIVERED') {
        if (order.status !== 'Delivered') return false;
      } else if (statusFilter === 'CANCELLED') {
        if (order.status !== 'Cancelled') return false;
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const orderNum = (order.orderNumber || order._id || '').toLowerCase();
        const customerName = `${order.address?.firstName || ''} ${order.address?.lastName || ''}`.toLowerCase();
        const phone = (order.address?.phone || '').toLowerCase();
        const city = (order.address?.city || '').toLowerCase();
        return orderNum.includes(q) || customerName.includes(q) || phone.includes(q) || city.includes(q);
      }

      return true;
    });
  }, [orders, statusFilter, searchQuery]);

  return (
    <div className='no-scrollbar flex-1 h-[95vh] overflow-y-scroll flex flex-col justify-between'>
      <div className="flex-1 py-6">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

          {/* Top Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Customer Orders</h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Track fulfillment progress, change delivery status, and verify cash collection.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchOrders}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-300 shadow-xs transition self-start sm:self-auto cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
              <span>Refresh Orders</span>
            </button>
          </div>

          {/* Filter Bar & Tabs */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: 'ALL', label: 'All Orders', count: orders.length },
                { id: 'ACTIVE', label: 'Active', count: orders.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled').length },
                { id: 'DELIVERED', label: 'Delivered', count: orders.filter(o => o.status === 'Delivered').length },
                { id: 'CANCELLED', label: 'Cancelled', count: orders.filter(o => o.status === 'Cancelled').length }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === tab.id
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    statusFilter === tab.id ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-200/70 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Quick Search */}
            <div className="relative sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search order #, customer..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 focus:bg-white focus:border-emerald-500 rounded-lg outline-none text-slate-800 placeholder:text-slate-400 transition"
              />
            </div>
          </div>

          {/* Orders List Container */}
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-xs">
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-medium text-slate-600">Loading customer orders...</p>
              </div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-xs">
              <div className="flex flex-col items-center justify-center gap-3 max-w-sm mx-auto">
                <div className="p-3 bg-slate-100 text-slate-400 rounded-full">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <p className="text-base font-bold text-slate-900">No orders found</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {searchQuery || statusFilter !== 'ALL'
                    ? "No orders match your filter criteria. Try resetting the filters or clearing search."
                    : "No orders have been placed yet. New customer orders will show up here automatically."}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => {
                const isTerminal = order.status === "Delivered" || order.status === "Cancelled";
                const isUpdatingStatus = updatingOrderId === order._id;
                const isUpdatingPayment = updatingOrderId === `${order._id}-pay`;
                const isAnyUpdating = isUpdatingStatus || isUpdatingPayment;
                const formattedDate = new Date(order.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                });

                return (
                  <div
                    key={order._id}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-sm transition overflow-hidden"
                  >
                    {/* Order Card Header */}
                    <div className="bg-slate-50/80 px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          {order.orderNumber || order._id}
                        </span>
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formattedDate}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Payment Status Pill */}
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          order.isPaid
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${order.isPaid ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                          {order.isPaid ? "Paid" : "Payment Pending"}
                        </span>

                        {/* Status Badge */}
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadgeClass(order.status)}`}>
                          {order.status}
                        </span>
                      </div>
                    </div>

                    {/* Order Card Body */}
                    <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-6">

                      {/* Items Column (5 cols) */}
                      <div className="md:col-span-5 space-y-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-slate-400" />
                          <span>Items Ordered ({order.items.length})</span>
                        </div>

                        <div className="divide-y divide-slate-100 space-y-2">
                          {order.items.map((item, itemIndex) => (
                            <div key={itemIndex} className="pt-2 first:pt-0 flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                                <img
                                  src={item.product?.image?.[0] || assets.box_icon}
                                  alt={item.product?.name || "Product"}
                                  className="w-full h-full object-cover rounded-md"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate" title={item.product?.name}>
                                  {item.product?.name || "Product Item"}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                  <span className="font-medium text-emerald-700">Qty: {item.quantity}</span>
                                  {item.product?.category && (
                                    <>
                                      <span>•</span>
                                      <span className="text-slate-400">{item.product.category}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {order.coupon && order.coupon.discountAmount > 0 && (
                          <div className="pt-2 flex items-center justify-between text-xs text-emerald-700 font-medium">
                            <span>Coupon Discount ({order.coupon.code}):</span>
                            <span>-{currency}{order.coupon.discountAmount}</span>
                          </div>
                        )}
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-xs text-slate-500 font-medium">Total Amount:</span>
                          <span className="text-base font-bold text-slate-900">{currency}{order.amount}</span>
                        </div>
                      </div>

                      {/* Customer & Shipping Details Column (4 cols) */}
                      <div className="md:col-span-4 space-y-2.5 md:border-l md:border-slate-100 md:pl-6">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>Shipping Destination</span>
                        </div>

                        <div className="text-xs space-y-1 text-slate-600">
                          <p className="text-sm font-bold text-slate-900">
                            {order.address?.firstName} {order.address?.lastName}
                          </p>
                          <p className="leading-relaxed">{order.address?.street}</p>
                          <p>{order.address?.city}, {order.address?.state} {order.address?.zipcode}</p>
                          <p className="font-medium text-slate-700">{order.address?.country}</p>

                          {order.address?.phone && (
                            <div className="pt-2 flex items-center gap-1.5 text-slate-700 font-medium">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span>{order.address.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Controls Column (3 cols) */}
                      <div className="md:col-span-3 space-y-3 md:border-l md:border-slate-100 md:pl-6 flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Fulfillment
                          </div>

                          <div className="text-xs space-y-1">
                            <span className="text-slate-500">Payment Method:</span>
                            <span className="ml-1.5 font-semibold text-slate-900 px-2 py-0.5 bg-slate-100 rounded text-xs">
                              {order.paymentType}
                            </span>
                          </div>

                          {/* COD Cash Collection Confirmation */}
                          {order.paymentType === "COD" && !order.isPaid && !isTerminal && (
                            <button
                              type="button"
                              onClick={() => handlePaymentUpdate(order._id, true)}
                              disabled={isAnyUpdating}
                              className="w-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-lg px-2.5 py-1.5 hover:bg-emerald-100 active:bg-emerald-200 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{isUpdatingPayment ? "Saving..." : "Confirm Cash Paid"}</span>
                            </button>
                          )}

                          {/* Order Status Selector */}
                          <div>
                            <label className="text-xs font-semibold text-slate-700 block mb-1">
                              Update Status
                            </label>
                            <select
                              value={order.status}
                              onChange={(e) => handleStatusUpdate(order._id, e.target.value)}
                              disabled={isTerminal || isAnyUpdating}
                              className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none transition ${
                                isTerminal
                                  ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200"
                                  : "bg-white border-slate-300 cursor-pointer focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 text-slate-800"
                              } ${isAnyUpdating ? "opacity-60 cursor-wait" : ""}`}
                            >
                              {STATUS_OPTIONS.map((statusOption) => (
                                <option key={statusOption} value={statusOption}>
                                  {statusOption}
                                </option>
                              ))}
                            </select>

                            {isTerminal && (
                              <span className="text-[11px] text-slate-400 mt-1 block italic">
                                Status locked ({order.status})
                              </span>
                            )}
                            {isUpdatingStatus && (
                              <span className="text-[11px] text-emerald-600 mt-1 block font-medium">
                                Updating order status...
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Orders;
