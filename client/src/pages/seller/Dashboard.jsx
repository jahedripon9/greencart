import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { assets } from '../../assets/assets';
import toast from 'react-hot-toast';

// =============================================================================
// SVG Icons (Clean, self-contained, lightweight)
// =============================================================================

const UsersIcon = ({ className = "w-6 h-6" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
    />
  </svg>
);

const OrdersIcon = ({ className = "w-6 h-6" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
    />
  </svg>
);

const SalesIcon = ({ className = "w-6 h-6" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
    />
  </svg>
);

const PendingIcon = ({ className = "w-6 h-6" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const RefreshIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

const AlertIcon = ({ className = "w-5 h-5 text-red-500 flex-shrink-0" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  </svg>
);

const CalendarIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const TrendingUpIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
    />
  </svg>
);

const TrendingDownIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
    />
  </svg>
);

const PackageIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
    />
  </svg>
);

const InfoCircleIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const DownloadIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
    />
  </svg>
);

const ChevronDownIcon = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
  </svg>
);

const FileCsvIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

const FileExcelIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M3 10h18M3 14h18M9 4v16m6-16v16M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z"
    />
  </svg>
);

const PrinterIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
    />
  </svg>
);

const ShieldCheckIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
    />
  </svg>
);

const CartIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
    />
  </svg>
);

const FunnelIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
    />
  </svg>
);

const EyeOffIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
    />
  </svg>
);

const CheckCircleIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

// =============================================================================
// Helper Formatting Functions
// =============================================================================

const formatNumber = (val) => {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return val.toLocaleString();
  }
  return '0';
};

const formatCurrency = (val, currency = '৳') => {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return `${currency}${val.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }
  return `${currency}0.00`;
};

const formatCompactCurrency = (val, currency = '৳') => {
  if (typeof val !== 'number' || !Number.isFinite(val)) return `${currency}0`;
  if (val >= 1000000) return `${currency}${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `${currency}${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`;
  return `${currency}${val.toLocaleString()}`;
};

const formatShortDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [, m, d] = parts.map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[m - 1]} ${d}`;
};

const formatFullDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts.map(Number);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${days[utcDate.getUTCDay()]}, ${months[m - 1]} ${d}, ${y}`;
};

const getCurrentDhakaMonth = () => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit'
  }).format(new Date());
};

// =============================================================================
// KPI Mini Sparkline Components (Zero external dependencies, SVG-based)
// =============================================================================

const KpiSparkline = ({ data = [], color = 'emerald', width = 96, height = 32 }) => {
  const points = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];
    const values = data.map((d) => (typeof d === 'number' ? d : Number(d?.value ?? d?.sales ?? 0)));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const pad = 2;
    const w = width - pad * 2;
    const h = height - pad * 2;

    return values.map((val, idx) => ({
      x: pad + (idx / Math.max(1, values.length - 1)) * w,
      y: height - pad - ((val - min) / range) * h,
      val
    }));
  }, [data, width, height]);

  if (points.length < 2) {
    return (
      <div style={{ width, height }} className="flex items-center justify-center opacity-25">
        <div className="w-full h-0.5 bg-slate-300 rounded-full" />
      </div>
    );
  }

  const linePath = points.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x},${pt.y}`;
    const prev = points[i - 1];
    const cp1x = prev.x + (pt.x - prev.x) / 2;
    const cp1y = prev.y;
    const cp2x = prev.x + (pt.x - prev.x) / 2;
    const cp2y = pt.y;
    return `${acc} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${pt.x},${pt.y}`;
  }, '');

  const areaPath = `${linePath} L ${points[points.length - 1].x},${height} L ${points[0].x},${height} Z`;

  const palette = {
    emerald: { stroke: '#10b981', stop: '#10b981', circle: '#059669' },
    blue: { stroke: '#3b82f6', stop: '#3b82f6', circle: '#2563eb' },
    purple: { stroke: '#8b5cf6', stop: '#8b5cf6', circle: '#7c3aed' },
    amber: { stroke: '#f59e0b', stop: '#f59e0b', circle: '#d97706' }
  };
  const theme = palette[color] || palette.emerald;
  const gradId = `spark-g-${color}-${width}-${height}`;

  return (
    <svg width={width} height={height} className="overflow-visible shrink-0">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.stop} stopOpacity="0.28" />
          <stop offset="100%" stopColor={theme.stop} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={theme.stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="2.5" fill={theme.circle} />
    </svg>
  );
};

const KpiBarSparkline = ({ data = [], color = 'blue', width = 96, height = 32 }) => {
  const bars = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];
    const values = data.map((d) => (typeof d === 'number' ? d : Number(d?.count ?? d?.orderCount ?? 0)));
    const max = Math.max(...values, 1);
    const count = values.length;
    const barW = Math.max(2.5, Math.min(6, Math.floor((width - (count - 1) * 2) / count)));
    const gap = (width - count * barW) / Math.max(1, count - 1);

    return values.map((val, i) => {
      const h = Math.max(2, (val / max) * (height - 3));
      return {
        x: i * (barW + gap),
        y: height - h,
        width: barW,
        height: h,
        val,
        isLast: i === count - 1
      };
    });
  }, [data, width, height]);

  if (!bars.length) {
    return (
      <div style={{ width, height }} className="flex items-center justify-center opacity-25">
        <div className="w-full h-0.5 bg-slate-300 rounded-full" />
      </div>
    );
  }

  const fillColors = {
    blue: { normal: '#bfdbfe', active: '#2563eb' },
    emerald: { normal: '#a7f3d0', active: '#059669' },
    purple: { normal: '#ddd6fe', active: '#7c3aed' },
    amber: { normal: '#fde68a', active: '#d97706' }
  };
  const theme = fillColors[color] || fillColors.blue;

  return (
    <svg width={width} height={height} className="overflow-hidden shrink-0">
      {bars.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={b.y}
          width={b.width}
          height={b.height}
          rx="1"
          fill={b.isLast ? theme.active : theme.normal}
        >
          <title>{`${b.val} orders`}</title>
        </rect>
      ))}
    </svg>
  );
};

// =============================================================================
// KPI Mini Card Header Component (Consistent Responsive Layout)
// =============================================================================

const KpiCardHeader = ({
  title,
  badge,
  icon: IconComponent,
  iconBg = 'from-emerald-50 to-teal-50',
  iconColor = 'text-emerald-600',
  iconBorder = 'border-emerald-200/60'
}) => (
  <div className="flex items-start justify-between gap-2.5 sm:gap-3">
    <div className="min-w-0 flex-1 flex flex-wrap items-center gap-1.5 sm:gap-2 pt-0.5">
      <span
        className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 max-w-full truncate"
        title={title}
      >
        {title}
      </span>
      {badge}
    </div>
    <div
      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${iconBg} ${iconColor} border ${iconBorder} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}
    >
      <IconComponent className="w-5 h-5" />
    </div>
  </div>
);

// =============================================================================
// CSV & SpreadsheetML Export Helpers
// =============================================================================

const escapeCsvCell = (val) => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const buildAnalyticsCsv = ({ range, kpis, dailySales, productBreakdown, orders, conversion, currency, totalSales }) => {
  const lines = [];

  // Report Metadata
  lines.push("GreenCart Advanced Sales Analytics & Performance Report");
  lines.push(`Reporting Period,${escapeCsvCell(`${range?.startDate || ''} to ${range?.endDate || ''}`)}`);
  lines.push(`Store Timezone,${escapeCsvCell(`${range?.timezone || 'Asia/Dhaka'} (+06:00)`)}`);
  lines.push(`Generated At,${escapeCsvCell(new Date().toISOString())}`);
  lines.push(`Currency,${escapeCsvCell(currency)}`);
  lines.push(`Order Rules,${escapeCsvCell('Qualifying Orders: Cash-on-Delivery (COD) and Paid Online Orders. Excludes Cancelled Orders.')}`);
  lines.push("");

  // Executive KPI Summary
  lines.push("--- EXECUTIVE KPI SUMMARY ---");
  lines.push("Metric,Value,Description");
  lines.push(`Total Customers,${kpis.totalUsers || 0},All registered customer accounts`);
  lines.push(`Total Orders,${kpis.totalOrders || 0},Confirmed qualifying orders in range`);
  lines.push(`Total Revenue (${currency}),${(kpis.totalRevenue || kpis.totalSales || 0).toFixed(2)},Total verified sales revenue (excludes cancelled)`);
  lines.push(`Average Order Value (${currency}),${(kpis.averageOrderValue || 0).toFixed(2)},Revenue divided by total qualifying orders`);
  lines.push(`Sales Growth Rate (%),${kpis.salesGrowth?.rate || 0}%,Compared to immediate prior period of equal length`);
  lines.push(`Pending Fulfillment,${kpis.totalPendingOrders || 0},Orders awaiting fulfillment`);
  lines.push("");

  // Order Pipeline Distribution
  if (orders?.statusBreakdown) {
    lines.push("--- ORDER PIPELINE BREAKDOWN ---");
    lines.push(`Status,Count,Amount (${currency})`);
    orders.statusBreakdown.forEach((s) => {
      lines.push(`${escapeCsvCell(s.status)},${s.count || 0},${(s.amount || 0).toFixed(2)}`);
    });
    lines.push("");
  }

  // Conversion Metrics
  if (conversion) {
    lines.push("--- CONVERSION FUNNEL METRICS ---");
    lines.push("Stage,Metric,Value,Status");
    lines.push("1. Store Visitors,Total Visitors,N/A,Tracking Not Configured");
    lines.push(`2. Active Carts,Users with Cart Items,${conversion.cart?.usersWithCart || 0},Active`);
    lines.push(`3. Checkout Initiations,Checkout OTP Attempts,${conversion.checkout?.checkoutInitiations || 0},Active`);
    lines.push(`4. Confirmed Orders,Completed Orders,${conversion.orders?.completedOrders || 0},Active`);
    lines.push(`Conversion Rate,Checkout to Order,${conversion.checkout?.checkoutInitiationRate || 0}%,Active`);
    lines.push(`Abandonment Rate,Cart Abandonment,${conversion.cartAbandonment?.cartAbandonmentRate || 0}%,Active`);
    lines.push("");
  }

  // Daily Sales Series
  lines.push("--- DAILY SALES TREND ---");
  lines.push(`Date,Revenue (${currency}),Confirmed Orders`);
  if (dailySales && dailySales.length > 0) {
    dailySales.forEach((day) => {
      const salesVal = typeof day.sales === 'number' ? day.sales.toFixed(2) : '0.00';
      lines.push(`${day.date},${salesVal},${day.orderCount || 0}`);
    });
  } else {
    lines.push("No daily sales records found for this period,,");
  }
  lines.push("");

  // Product-wise Sales Breakdown
  lines.push("--- TOP SELLING PRODUCTS BREAKDOWN ---");
  lines.push(`Rank,Product ID,Product Name,Category,Units Sold,Orders,Revenue (${currency}),Revenue Share (%),Pricing Status`);
  if (productBreakdown && productBreakdown.length > 0) {
    productBreakdown.forEach((p, idx) => {
      const rank = idx + 1;
      const pid = p.productId || '';
      const name = p.name || 'Unknown Product';
      const category = p.category || 'Uncategorized';
      const units = p.unitsSold || 0;
      const orderCount = p.orderCount || 0;

      let revenueStr = 'N/A';
      let shareStr = 'N/A';
      let pricingStatus = 'Historical unit price missing';

      if (p.revenueComplete && typeof p.revenue === 'number') {
        revenueStr = p.revenue.toFixed(2);
        pricingStatus = 'Complete';
        if (totalSales > 0) {
          shareStr = `${((p.revenue / totalSales) * 100).toFixed(1)}%`;
        }
      }

      lines.push(
        [
          rank,
          escapeCsvCell(pid),
          escapeCsvCell(name),
          escapeCsvCell(category),
          units,
          orderCount,
          revenueStr,
          shareStr,
          escapeCsvCell(pricingStatus)
        ].join(',')
      );
    });
  } else {
    lines.push("No product sales recorded for this period,,,,,,,,");
  }

  const hasIncomplete = productBreakdown?.some((p) => p.revenueComplete === false);
  if (hasIncomplete) {
    lines.push("");
    lines.push("Notice: Historical unit prices were not recorded for some legacy orders. Affected items display N/A for revenue to avoid inaccurate estimates.");
  }

  return lines.join("\r\n");
};

const escapeXml = (val) => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const buildAnalyticsSpreadsheetXml = ({ range, kpis, dailySales, productBreakdown, orders, currency, totalSales }) => {
  const hasIncomplete = productBreakdown?.some((p) => p.revenueComplete === false);
  const generatedTime = new Date().toISOString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>GreenCart Store Management</Author>
  <Title>Advanced Sales Analytics Report (${escapeXml(range?.startDate)} to ${escapeXml(range?.endDate)})</Title>
  <Created>${generatedTime}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1E293B"/>
  </Style>
  <Style ss:ID="ReportTitle">
   <Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#0F172A"/>
   <Alignment ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="MetaLabel">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#475569"/>
   <Alignment ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="MetaValue">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/>
   <Alignment ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="TableHeader">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#4F46E5" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="TableHeaderLeft">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#4F46E5" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="TableHeaderRight">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#4F46E5" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="TextLeft">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="TextCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="TextRight">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="NumInt">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="#,##0"/>
  </Style>
  <Style ss:ID="NumCurr">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>
  <Style ss:ID="NoticeBox">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#92400E" ss:Italic="1"/>
   <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center"/>
  </Style>
 </Styles>
`;

  // Worksheet 1: Executive Summary
  xml += ` <Worksheet ss:Name="Executive Summary">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="200"/>
   <Column ss:Width="160"/>
   <Column ss:Width="300"/>
   <Row ss:Height="24">
    <Cell ss:StyleID="ReportTitle"><Data ss:Type="String">GreenCart — Executive Sales Summary</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Reporting Period</Data></Cell>
    <Cell ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(range?.startDate)} to ${escapeXml(range?.endDate)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Store Timezone</Data></Cell>
    <Cell ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(range?.timezone || 'Asia/Dhaka')} (+06:00)</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Store Currency</Data></Cell>
    <Cell ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(currency)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Report Generated</Data></Cell>
    <Cell ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(generatedTime)}</Data></Cell>
   </Row>
   <Row/>
   <Row ss:Height="22">
    <Cell ss:StyleID="TableHeaderLeft"><Data ss:Type="String">Key Performance Indicator</Data></Cell>
    <Cell ss:StyleID="TableHeaderRight"><Data ss:Type="String">Value</Data></Cell>
    <Cell ss:StyleID="TableHeaderLeft"><Data ss:Type="String">Description</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextLeft"><Data ss:Type="String">Total Customers</Data></Cell>
    <Cell ss:StyleID="NumInt"><Data ss:Type="Number">${kpis.totalUsers || 0}</Data></Cell>
    <Cell ss:StyleID="TextLeft"><Data ss:Type="String">All registered customer accounts</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextLeft"><Data ss:Type="String">Total Orders</Data></Cell>
    <Cell ss:StyleID="NumInt"><Data ss:Type="Number">${kpis.totalOrders || 0}</Data></Cell>
    <Cell ss:StyleID="TextLeft"><Data ss:Type="String">Confirmed qualifying orders in range</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextLeft"><Data ss:Type="String">Total Revenue (${escapeXml(currency)})</Data></Cell>
    <Cell ss:StyleID="NumCurr"><Data ss:Type="Number">${kpis.totalRevenue || kpis.totalSales || 0}</Data></Cell>
    <Cell ss:StyleID="TextLeft"><Data ss:Type="String">Excludes cancelled orders</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextLeft"><Data ss:Type="String">Average Order Value (AOV)</Data></Cell>
    <Cell ss:StyleID="NumCurr"><Data ss:Type="Number">${kpis.averageOrderValue || 0}</Data></Cell>
    <Cell ss:StyleID="TextLeft"><Data ss:Type="String">Revenue per confirmed order</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextLeft"><Data ss:Type="String">Sales Growth Rate</Data></Cell>
    <Cell ss:StyleID="TextRight"><Data ss:Type="String">${kpis.salesGrowth?.rate || 0}%</Data></Cell>
    <Cell ss:StyleID="TextLeft"><Data ss:Type="String">vs immediate prior period</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextLeft"><Data ss:Type="String">Pending Fulfillment</Data></Cell>
    <Cell ss:StyleID="NumInt"><Data ss:Type="Number">${kpis.totalPendingOrders || 0}</Data></Cell>
    <Cell ss:StyleID="TextLeft"><Data ss:Type="String">Orders awaiting delivery fulfillment</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
`;

  // Worksheet 2: Daily Trends
  xml += ` <Worksheet ss:Name="Daily Trends">
  <Table ss:DefaultRowHeight="19">
   <Column ss:Width="120"/>
   <Column ss:Width="150"/>
   <Column ss:Width="120"/>
   <Row ss:Height="22">
    <Cell ss:StyleID="ReportTitle" ss:MergeAcross="2"><Data ss:Type="String">Daily Sales &amp; Order Trend</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Date</Data></Cell>
    <Cell ss:StyleID="TableHeaderRight"><Data ss:Type="String">Revenue (${escapeXml(currency)})</Data></Cell>
    <Cell ss:StyleID="TableHeaderRight"><Data ss:Type="String">Confirmed Orders</Data></Cell>
   </Row>
`;
  if (dailySales && dailySales.length > 0) {
    dailySales.forEach((d) => {
      const s = typeof d.sales === 'number' ? d.sales : 0;
      const c = typeof d.orderCount === 'number' ? d.orderCount : 0;
      xml += `   <Row>
    <Cell ss:StyleID="TextCenter"><Data ss:Type="String">${escapeXml(d.date)}</Data></Cell>
    <Cell ss:StyleID="NumCurr"><Data ss:Type="Number">${s}</Data></Cell>
    <Cell ss:StyleID="NumInt"><Data ss:Type="Number">${c}</Data></Cell>
   </Row>
`;
    });
  }
  xml += `  </Table>
 </Worksheet>
`;

  // Worksheet 3: Product Breakdown
  xml += ` <Worksheet ss:Name="Product Breakdown">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="60"/>
   <Column ss:Width="240"/>
   <Column ss:Width="140"/>
   <Column ss:Width="90"/>
   <Column ss:Width="80"/>
   <Column ss:Width="130"/>
   <Column ss:Width="110"/>
   <Column ss:Width="180"/>
   <Row ss:Height="22">
    <Cell ss:StyleID="ReportTitle" ss:MergeAcross="7"><Data ss:Type="String">Top Selling Products Breakdown</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Rank</Data></Cell>
    <Cell ss:StyleID="TableHeaderLeft"><Data ss:Type="String">Product Name</Data></Cell>
    <Cell ss:StyleID="TableHeaderLeft"><Data ss:Type="String">Category</Data></Cell>
    <Cell ss:StyleID="TableHeaderRight"><Data ss:Type="String">Units Sold</Data></Cell>
    <Cell ss:StyleID="TableHeaderRight"><Data ss:Type="String">Orders</Data></Cell>
    <Cell ss:StyleID="TableHeaderRight"><Data ss:Type="String">Revenue (${escapeXml(currency)})</Data></Cell>
    <Cell ss:StyleID="TableHeaderRight"><Data ss:Type="String">Revenue Share</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Pricing Status</Data></Cell>
   </Row>
`;
  if (productBreakdown && productBreakdown.length > 0) {
    productBreakdown.forEach((p, idx) => {
      const rank = idx + 1;
      const name = escapeXml(p.name || 'Unknown Product');
      const category = escapeXml(p.category || 'Uncategorized');
      const units = p.unitsSold || 0;
      const orderCount = p.orderCount || 0;
      const isRevValid = p.revenueComplete && typeof p.revenue === 'number';

      xml += `   <Row>
    <Cell ss:StyleID="TextCenter"><Data ss:Type="Number">${rank}</Data></Cell>
    <Cell ss:StyleID="TextLeft"><Data ss:Type="String">${name}</Data></Cell>
    <Cell ss:StyleID="TextLeft"><Data ss:Type="String">${category}</Data></Cell>
    <Cell ss:StyleID="NumInt"><Data ss:Type="Number">${units}</Data></Cell>
    <Cell ss:StyleID="NumInt"><Data ss:Type="Number">${orderCount}</Data></Cell>
`;
      if (isRevValid) {
        xml += `    <Cell ss:StyleID="NumCurr"><Data ss:Type="Number">${p.revenue}</Data></Cell>
`;
      } else {
        xml += `    <Cell ss:StyleID="TextRight"><Data ss:Type="String">N/A</Data></Cell>
`;
      }

      if (isRevValid && totalSales > 0) {
        const share = ((p.revenue / totalSales) * 100).toFixed(1) + '%';
        xml += `    <Cell ss:StyleID="TextRight"><Data ss:Type="String">${share}</Data></Cell>
`;
      } else {
        xml += `    <Cell ss:StyleID="TextRight"><Data ss:Type="String">N/A</Data></Cell>
`;
      }

      const status = p.revenueComplete ? 'Complete' : 'Historical unit price missing';
      xml += `    <Cell ss:StyleID="TextCenter"><Data ss:Type="String">${status}</Data></Cell>
   </Row>
`;
    });
  }

  if (hasIncomplete) {
    xml += `   <Row/>
   <Row ss:Height="24">
    <Cell ss:StyleID="NoticeBox" ss:MergeAcross="7"><Data ss:Type="String">Notice: Some historical orders do not contain recorded unit prices. Revenue figures for affected products are marked as N/A to maintain financial audit integrity.</Data></Cell>
   </Row>
`;
  }

  xml += `  </Table>
 </Worksheet>
</Workbook>`;

  return xml;
};

// =============================================================================
// Component: Multi-Timeframe Interactive Native SVG Chart
// =============================================================================

const InteractiveChart = ({
  data = [],
  timeframe = 'daily', // 'daily' | 'weekly' | 'monthly' | 'yearly' | 'growth'
  currency = '৳',
  loading = false,
  totalSales = 0,
  totalOrders = 0,
  range
}) => {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(null);
  const [containerWidth, setContainerWidth] = useState(800);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Coordinate dimensions
  const svgWidth = 800;
  const svgHeight = 280;
  const marginLeft = 65;
  const marginRight = 24;
  const marginTop = 20;
  const marginBottom = 40;
  const chartWidth = svgWidth - marginLeft - marginRight;
  const chartHeight = svgHeight - marginTop - marginBottom;

  const isGrowthMode = timeframe === 'growth';

  const { maxValue, minValue, yTicks, points, linePath, areaPath, hasData, peakPoint } = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        maxValue: 100,
        minValue: 0,
        yTicks: [0, 25, 50, 75, 100],
        points: [],
        linePath: '',
        areaPath: '',
        hasData: false,
        peakPoint: null
      };
    }

    let max = -Infinity;
    let min = Infinity;
    let peak = data[0];

    data.forEach((d) => {
      const val = isGrowthMode
        ? (typeof d.growthRate === 'number' ? d.growthRate : 0)
        : (typeof d.sales === 'number' ? d.sales : 0);
      if (val > max) max = val;
      if (val < min) min = val;
      if (val > (isGrowthMode ? (peak?.growthRate || 0) : (peak?.sales || 0))) {
        peak = d;
      }
    });

    if (!Number.isFinite(max)) max = 100;
    if (!Number.isFinite(min)) min = 0;

    let effectiveMax = max;
    let effectiveMin = isGrowthMode ? Math.min(0, min) : 0;
    if (effectiveMax <= effectiveMin) {
      effectiveMax = effectiveMin + 100;
    }

    // Generate 5 evenly spaced ticks
    const rangeSpan = effectiveMax - effectiveMin;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
      const val = effectiveMin + rangeSpan * f;
      return Math.round(val * 10) / 10;
    });

    const ptsCount = data.length;
    const pts = data.map((d, i) => {
      const val = isGrowthMode
        ? (typeof d.growthRate === 'number' ? d.growthRate : 0)
        : (typeof d.sales === 'number' ? d.sales : 0);

      const x = ptsCount === 1
        ? marginLeft + chartWidth / 2
        : marginLeft + (i / (ptsCount - 1)) * chartWidth;

      const y = marginTop + chartHeight - ((val - effectiveMin) / rangeSpan) * chartHeight;

      let label = d.date || d.label || d.week || d.month || d.year || `P${i + 1}`;
      return { x, y, val, label, data: d };
    });

    let lPath = '';
    let aPath = '';

    if (pts.length > 0) {
      lPath = pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`, '');
      const firstX = pts[0].x.toFixed(1);
      const lastX = pts[pts.length - 1].x.toFixed(1);
      const bottomY = (marginTop + chartHeight).toFixed(1);
      aPath = `${lPath} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`;
    }

    return {
      maxValue: effectiveMax,
      minValue: effectiveMin,
      yTicks: ticks,
      points: pts,
      linePath: lPath,
      areaPath: aPath,
      hasData: data.some(d => (isGrowthMode ? (d.growthRate !== 0) : (d.sales > 0))),
      peakPoint: peak
    };
  }, [data, isGrowthMode, chartWidth, chartHeight, marginLeft, marginTop]);

  const xTicks = useMemo(() => {
    if (!points || points.length === 0) return [];
    const n = points.length;
    if (n <= 8) return points.map((p, i) => ({ x: p.x, label: p.label, index: i }));

    let step = 2;
    if (n > 180) step = 45;
    else if (n > 90) step = 20;
    else if (n > 40) step = 8;
    else if (n > 20) step = 4;
    else if (n > 10) step = 2;

    const result = [];
    for (let i = 0; i < n; i += step) {
      result.push({ x: points[i].x, label: points[i].label, index: i });
    }
    const lastIdx = n - 1;
    if (result[result.length - 1].index !== lastIdx && lastIdx - result[result.length - 1].index >= step / 2) {
      result.push({ x: points[lastIdx].x, label: points[lastIdx].label, index: lastIdx });
    }
    return result;
  }, [points]);

  const handlePointer = (e) => {
    if (!points || points.length === 0 || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const relativeX = clientX - rect.left;
    const svgX = (relativeX / rect.width) * svgWidth;

    if (svgX < marginLeft - 10 || svgX > svgWidth - marginRight + 10) {
      setActiveIndex(null);
      return;
    }

    const ratio = Math.max(0, Math.min(1, (svgX - marginLeft) / chartWidth));
    const idx = Math.round(ratio * (points.length - 1));
    const clamped = Math.max(0, Math.min(points.length - 1, idx));
    setActiveIndex(clamped);
  };

  const activePoint = activeIndex !== null && points[activeIndex] ? points[activeIndex] : null;

  const tooltipLeft = activePoint
    ? Math.max(80, Math.min(containerWidth - 80, (activePoint.x / svgWidth) * containerWidth))
    : 0;

  const tooltipTopRatio = activePoint ? activePoint.y / svgHeight : 0;
  const isTooltipNearTop = tooltipTopRatio < 0.35;

  return (
    <div className="bg-white border border-gray-200/80 rounded-2xl p-5 md:p-6 shadow-xs select-none">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUpIcon className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-gray-800">
              {isGrowthMode ? 'Sales Growth Rate Trend' : 'Sales Revenue & Volume Trend'}
            </h3>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {isGrowthMode
              ? 'Chronological percentage variation compared with preceding intervals'
              : `Aggregated sales performance (${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} view)`}
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          {peakPoint && !isGrowthMode && peakPoint.sales > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 font-medium">
              <span>Peak:</span>
              <span className="font-bold">{formatCurrency(peakPoint.sales, currency)}</span>
              <span className="text-emerald-500">({peakPoint.date || peakPoint.label || peakPoint.week})</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-gray-600">
            <span className={`w-3 h-1 rounded-full inline-block ${isGrowthMode ? 'bg-indigo-600' : 'bg-emerald-600'}`}></span>
            <span>{isGrowthMode ? 'Growth Rate (%)' : `Revenue (${currency})`}</span>
          </div>
        </div>
      </div>

      {/* Empty State Banner */}
      {!loading && !hasData && data.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 text-center">
          No sales transactions recorded for this interval. All series values are zero.
        </div>
      )}

      {/* SVG Canvas */}
      <div ref={containerRef} className="relative w-full mt-4 touch-pan-y">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-64 sm:h-72 md:h-80 overflow-visible cursor-crosshair"
          onMouseMove={handlePointer}
          onMouseLeave={() => setActiveIndex(null)}
          onTouchMove={handlePointer}
          onTouchEnd={() => setActiveIndex(null)}
        >
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isGrowthMode ? "#6366f1" : "#10b981"} stopOpacity="0.28" />
              <stop offset="90%" stopColor={isGrowthMode ? "#6366f1" : "#10b981"} stopOpacity="0.02" />
              <stop offset="100%" stopColor={isGrowthMode ? "#6366f1" : "#10b981"} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines and Y-axis ticks */}
          {yTicks.map((val, idx) => {
            const rangeSpan = maxValue - minValue || 1;
            const y = marginTop + chartHeight - ((val - minValue) / rangeSpan) * chartHeight;
            return (
              <g key={idx}>
                <line
                  x1={marginLeft}
                  y1={y}
                  x2={svgWidth - marginRight}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={marginLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize="11"
                  fill="#64748b"
                  className="font-mono font-medium"
                >
                  {isGrowthMode ? `${val}%` : formatCompactCurrency(val, currency)}
                </text>
              </g>
            );
          })}

          {/* X-axis ticks */}
          {xTicks.map((t, idx) => (
            <text
              key={idx}
              x={t.x}
              y={svgHeight - 12}
              textAnchor="middle"
              fontSize="11"
              fill="#64748b"
              className="font-medium"
            >
              {typeof t.label === 'string' && t.label.includes('-') && t.label.length === 10
                ? formatShortDate(t.label)
                : t.label}
            </text>
          ))}

          {/* Baseline */}
          <line
            x1={marginLeft}
            y1={marginTop + chartHeight}
            x2={svgWidth - marginRight}
            y2={marginTop + chartHeight}
            stroke="#94a3b8"
            strokeWidth="1.5"
          />

          {/* Area fill */}
          {areaPath && points.length > 1 && (
            <path d={areaPath} fill="url(#chartGrad)" />
          )}

          {/* Stroke Line */}
          {linePath && points.length > 1 && (
            <path
              d={linePath}
              fill="none"
              stroke={isGrowthMode ? "#4f46e5" : "#059669"}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Single point display */}
          {points.length === 1 && points[0] && (
            <circle
              cx={points[0].x}
              cy={points[0].y}
              r="5"
              fill={isGrowthMode ? "#4f46e5" : "#059669"}
              stroke="#ffffff"
              strokeWidth="2"
            />
          )}

          {/* Active pointer guide */}
          {activePoint && (
            <g>
              <line
                x1={activePoint.x}
                y1={marginTop}
                x2={activePoint.x}
                y2={marginTop + chartHeight}
                stroke={isGrowthMode ? "#818cf8" : "#34d399"}
                strokeDasharray="3 3"
                strokeWidth="1.5"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="6"
                fill="#ffffff"
                stroke={isGrowthMode ? "#4f46e5" : "#059669"}
                strokeWidth="3"
                className="drop-shadow-md"
              />
            </g>
          )}
        </svg>

        {/* Floating Tooltip */}
        {activePoint && (
          <div
            className="absolute pointer-events-none z-20 bg-slate-900/95 text-white px-3.5 py-2.5 rounded-xl shadow-xl backdrop-blur-sm border border-slate-700/60 text-xs transition-all duration-75"
            style={{
              left: `${tooltipLeft}px`,
              top: isTooltipNearTop ? '60px' : `${(activePoint.y / svgHeight) * 100}%`,
              transform: isTooltipNearTop ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
              marginTop: isTooltipNearTop ? '12px' : '-12px'
            }}
          >
            <div className="font-semibold text-slate-200 border-b border-slate-700/70 pb-1 mb-1.5 whitespace-nowrap">
              {activePoint.data.date ? formatFullDate(activePoint.data.date) : activePoint.label}
            </div>

            {isGrowthMode ? (
              <>
                <div className="flex items-center justify-between gap-4 py-0.5">
                  <span className="text-slate-400">Growth Rate:</span>
                  <span className={`font-mono font-bold ${activePoint.val >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {activePoint.val >= 0 ? `+${activePoint.val}%` : `${activePoint.val}%`}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 py-0.5">
                  <span className="text-slate-400">Sales:</span>
                  <span className="font-mono font-medium text-white">
                    {formatCurrency(activePoint.data.sales, currency)}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-5 py-0.5">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    Revenue:
                  </span>
                  <span className="font-bold text-white font-mono">
                    {formatCurrency(activePoint.data.sales, currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-5 py-0.5">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                    Orders:
                  </span>
                  <span className="font-semibold text-blue-300">
                    {formatNumber(activePoint.data.orderCount)} {activePoint.data.orderCount === 1 ? 'order' : 'orders'}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-100 mt-2">
        <span>Hover or touch chart points to view breakdown</span>
        <span>Store Timezone: {range?.timezone || 'Asia/Dhaka (+06:00)'}</span>
      </div>
    </div>
  );
};

// =============================================================================
// Component: Product Performance Section
// =============================================================================

const ProductPerformance = ({ productsData = {}, totalSales = 0, currency = '৳' }) => {
  const [activeSubTab, setActiveSubTab] = useState('bestSelling'); // 'bestSelling' | 'topRevenue' | 'mostOrdered' | 'lowStock'

  const currentItems = useMemo(() => {
    if (activeSubTab === 'bestSelling') return productsData.bestSelling || [];
    if (activeSubTab === 'topRevenue') return productsData.topRevenue || [];
    if (activeSubTab === 'mostOrdered') return productsData.mostOrdered || [];
    if (activeSubTab === 'lowStock') return productsData.lowStock || [];
    return [];
  }, [activeSubTab, productsData]);

  const hasIncompleteRevenue = useMemo(
    () => currentItems.some((p) => p.revenueComplete === false),
    [currentItems]
  );

  return (
    <div className="bg-white border border-gray-200/80 rounded-2xl p-5 md:p-6 shadow-xs space-y-5">
      {/* Sub-tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <PackageIcon className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-gray-800">Product Performance Intelligence</h3>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Ranked catalog performance by revenue, sales volume, order frequency, and inventory stock risk
          </p>
        </div>

        {/* Sub-tab Pills */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-gray-100 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('bestSelling')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeSubTab === 'bestSelling'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Best Selling
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('topRevenue')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeSubTab === 'topRevenue'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Top Revenue
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('mostOrdered')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeSubTab === 'mostOrdered'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Most Ordered
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('lowStock')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'lowStock'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-amber-700 hover:text-amber-900'
            }`}
          >
            <span>Low Stock</span>
            {productsData.lowStock?.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-white text-amber-800 font-bold text-[10px] flex items-center justify-center">
                {productsData.lowStock.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Historical Revenue Disclaimer when unpriced items exist */}
      {hasIncompleteRevenue && activeSubTab !== 'lowStock' && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
          <InfoCircleIcon className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-semibold">Notice regarding historical orders:</span> Some customer orders were recorded prior to unit price capture. In adherence with financial audit integrity, revenue for affected items is marked as <span className="font-semibold underline">N/A</span> rather than estimated.
          </div>
        </div>
      )}

      {/* Table Content */}
      {currentItems.length === 0 ? (
        <div className="py-12 px-4 text-center bg-gray-50/60 rounded-xl border border-dashed border-gray-200">
          <PackageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-gray-700">No products found in this category</h4>
          <p className="text-xs text-gray-500 mt-1">
            {activeSubTab === 'lowStock'
              ? 'Great news! All catalog products maintain healthy inventory levels above low-stock thresholds.'
              : 'There were no confirmed orders for items during the selected period.'}
          </p>
        </div>
      ) : activeSubTab === 'lowStock' ? (
        // Low Stock Products Table
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 uppercase text-[11px] tracking-wider font-semibold">
                <th className="py-3 px-3">Product Name &amp; Category</th>
                <th className="py-3 px-3 text-right">Price</th>
                <th className="py-3 px-3 text-right">Available Stock</th>
                <th className="py-3 px-3 text-right">Threshold</th>
                <th className="py-3 px-3 text-center">Status Badge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentItems.map((p, idx) => (
                <tr key={p.productId || idx} className="hover:bg-gray-50/70 transition-colors">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={p.image || assets.upload_area}
                        alt={p.name}
                        onError={(e) => { e.currentTarget.src = assets.upload_area; }}
                        className="w-10 h-10 rounded-lg object-cover border border-gray-100 bg-gray-50 flex-shrink-0"
                      />
                      <div>
                        <div className="font-semibold text-gray-900">{p.name}</div>
                        <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full inline-block mt-0.5">
                          {p.category}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-medium text-gray-800">
                    {formatCurrency(p.price, currency)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-gray-900">
                    {p.stockQuantity}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-gray-500">
                    {p.lowStockThreshold}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        p.status === 'Out of Stock'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // Sales Performance Table
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 uppercase text-[11px] tracking-wider font-semibold">
                <th className="py-3 px-3 text-center w-12">Rank</th>
                <th className="py-3 px-3">Product Name &amp; Category</th>
                <th className="py-3 px-3 text-right">Units Sold</th>
                <th className="py-3 px-3 text-right">Orders</th>
                <th className="py-3 px-3 text-right">Revenue ({currency})</th>
                <th className="py-3 px-3 text-right">Revenue Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentItems.map((p, idx) => {
                const rank = idx + 1;
                const isRevenueValid = p.revenueComplete && typeof p.revenue === 'number';
                const sharePercentage = isRevenueValid && totalSales > 0
                  ? ((p.revenue / totalSales) * 100).toFixed(1)
                  : null;

                return (
                  <tr key={p.productId || idx} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3 px-3 text-center align-middle font-bold">
                      <span className="w-6 h-6 rounded-full inline-flex items-center justify-center bg-gray-100 text-gray-700 text-xs font-mono">
                        #{rank}
                      </span>
                    </td>
                    <td className="py-3 px-3 align-middle">
                      <div className="flex items-center gap-3">
                        <img
                          src={p.image || assets.upload_area}
                          alt={p.name}
                          onError={(e) => { e.currentTarget.src = assets.upload_area; }}
                          className="w-10 h-10 rounded-lg object-cover border border-gray-100 bg-gray-50 flex-shrink-0"
                        />
                        <div className="min-w-0 max-w-xs sm:max-w-md">
                          <div className="font-semibold text-gray-900 truncate" title={p.name}>
                            {p.name}
                          </div>
                          <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full inline-block mt-0.5">
                            {p.category}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right align-middle font-mono font-semibold text-gray-900">
                      {formatNumber(p.unitsSold)}
                    </td>
                    <td className="py-3 px-3 text-right align-middle font-mono text-gray-600">
                      {formatNumber(p.orderCount)}
                    </td>
                    <td className="py-3 px-3 text-right align-middle font-mono font-bold text-gray-900">
                      {isRevenueValid ? formatCurrency(p.revenue, currency) : (
                        <span className="text-amber-600 font-semibold" title="Historical unit price not captured">N/A*</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right align-middle">
                      {sharePercentage !== null ? (
                        <div className="flex flex-col items-end">
                          <span className="font-mono font-semibold text-gray-800">{sharePercentage}%</span>
                          <div className="w-16 bg-gray-100 rounded-full h-1.5 mt-1 overflow-hidden">
                            <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${Math.min(100, Number(sharePercentage))}%` }}></div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Component: Order Analytics Section
// =============================================================================

const OrderAnalytics = ({ ordersData = {}, currency = '৳' }) => {
  const { totalOrders = 0, pendingOrders = 0, processingOrders = 0, completedOrders = 0, cancelledOrders = 0, statusBreakdown = [] } = ordersData;

  const statusConfig = {
    "Order Placed": { color: "bg-blue-500", text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
    "Packing": { color: "bg-indigo-500", text: "text-indigo-700", bg: "bg-indigo-50", border: "border-indigo-200" },
    "Shipped": { color: "bg-purple-500", text: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200" },
    "Out for Delivery": { color: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
    "Delivered": { color: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
    "Cancelled": { color: "bg-rose-500", text: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200" }
  };

  return (
    <div className="bg-white border border-gray-200/80 rounded-2xl p-5 md:p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="border-b border-gray-100 pb-4">
        <div className="flex items-center gap-2">
          <OrdersIcon className="w-5 h-5 text-indigo-600" />
          <h3 className="text-base font-bold text-gray-800">Order Fulfillment &amp; Pipeline Analytics</h3>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          Real-time tracking of orders through placement, processing, delivery, and completion
        </p>
      </div>

      {/* 5-Card Status Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Orders</span>
          <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">{formatNumber(totalOrders)}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">All qualifying records</span>
        </div>
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200/80">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">Pending</span>
          <span className="text-2xl font-bold font-mono text-amber-900 mt-1 block">{formatNumber(pendingOrders)}</span>
          <span className="text-[10px] text-amber-600 mt-0.5 block">Awaiting fulfillment</span>
        </div>
        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200/80">
          <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block">Processing</span>
          <span className="text-2xl font-bold font-mono text-indigo-900 mt-1 block">{formatNumber(processingOrders)}</span>
          <span className="text-[10px] text-indigo-600 mt-0.5 block">Packing / In transit</span>
        </div>
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200/80">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Completed</span>
          <span className="text-2xl font-bold font-mono text-emerald-900 mt-1 block">{formatNumber(completedOrders)}</span>
          <span className="text-[10px] text-emerald-600 mt-0.5 block">Successfully delivered</span>
        </div>
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200/80 col-span-2 sm:col-span-1">
          <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">Cancelled</span>
          <span className="text-2xl font-bold font-mono text-rose-900 mt-1 block">{formatNumber(cancelledOrders)}</span>
          <span className="text-[10px] text-rose-600 mt-0.5 block">Excluded from revenue</span>
        </div>
      </div>

      {/* Visual Pipeline Bar */}
      <div>
        <div className="flex justify-between items-center text-xs font-semibold text-gray-700 mb-2">
          <span>Order Status Distribution Pipeline</span>
          <span className="text-gray-400 font-normal">{totalOrders} total orders</span>
        </div>
        <div className="w-full h-3.5 bg-gray-100 rounded-full overflow-hidden flex shadow-inner">
          {statusBreakdown.map((s, idx) => {
            const count = s.count || 0;
            const pct = totalOrders > 0 ? (count / totalOrders) * 100 : 0;
            if (pct <= 0) return null;
            const cfg = statusConfig[s.status] || { color: "bg-gray-400" };
            return (
              <div
                key={idx}
                className={`${cfg.color} h-full transition-all duration-300 relative group`}
                style={{ width: `${pct}%` }}
                title={`${s.status}: ${count} (${pct.toFixed(1)}%)`}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3.5 mt-2.5 text-[11px] text-gray-500">
          {Object.entries(statusConfig).map(([statusName, cfg]) => (
            <div key={statusName} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${cfg.color}`}></span>
              <span>{statusName}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Status Breakdown Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-100 text-gray-400 uppercase text-[11px] tracking-wider font-semibold">
              <th className="py-2.5 px-3">Order Status</th>
              <th className="py-2.5 px-3 text-right">Order Count</th>
              <th className="py-2.5 px-3 text-right">Order Value ({currency})</th>
              <th className="py-2.5 px-3 text-right">Share of Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {statusBreakdown.map((item, idx) => {
              const cfg = statusConfig[item.status] || { text: "text-gray-700", bg: "bg-gray-50", border: "border-gray-200" };
              const pct = totalOrders > 0 ? ((item.count / totalOrders) * 100).toFixed(1) : '0.0';
              return (
                <tr key={idx} className="hover:bg-gray-50/70 transition-colors">
                  <td className="py-3 px-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-gray-800">
                    {formatNumber(item.count)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-gray-800">
                    {formatCurrency(item.amount, currency)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-gray-600">
                    {pct}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// =============================================================================
// Component: Conversion Funnel Section
// =============================================================================

const ConversionFunnel = ({ conversionData = {} }) => {
  const visitors = conversionData.visitors || {};
  const cart = conversionData.cart || {};
  const checkout = conversionData.checkout || {};
  const orders = conversionData.orders || {};
  const cartAbandonment = conversionData.cartAbandonment || {};

  return (
    <div className="bg-white border border-gray-200/80 rounded-2xl p-5 md:p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="border-b border-gray-100 pb-4">
        <div className="flex items-center gap-2">
          <FunnelIcon className="w-5 h-5 text-indigo-600" />
          <h3 className="text-base font-bold text-gray-800">Customer Conversion Funnel &amp; Behavior</h3>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          Step-by-step conversion pipeline calculated from authentic user carts, checkout OTPs, and confirmed orders
        </p>
      </div>

      {/* Honest Tracking Disclosure Banner (Decision #5) */}
      {!visitors.available && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3 text-xs text-slate-700">
          <EyeOffIcon className="w-5 h-5 text-slate-500 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <span className="font-bold text-slate-900 block">Web Visitor Tracking Status: Not Configured</span>
            <p className="text-slate-600 leading-relaxed">
              GreenCart strictly derives conversion metrics from verified transactional tables. Because a dedicated pageview tracking engine is not enabled in this environment, visitor traffic metrics are marked as <strong className="font-semibold text-slate-800">Unavailable</strong> rather than synthesized or fabricated. Active cart and checkout conversion metrics remain fully verified.
            </p>
          </div>
        </div>
      )}

      {/* 4-Step Funnel Visualizer */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
        {/* Step 1: Visitors */}
        <div className="p-4 rounded-xl border border-dashed border-gray-300 bg-gray-50/60 relative">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Step 01</span>
          <h4 className="text-sm font-bold text-gray-700 mt-0.5">Store Visitors</h4>
          <div className="mt-3">
            <span className="inline-block px-2 py-0.5 rounded bg-gray-200 text-gray-600 text-xs font-semibold">
              Not Configured
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">Requires external web analytics integration</p>
        </div>

        {/* Step 2: Carts */}
        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 relative">
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Step 02</span>
          <h4 className="text-sm font-bold text-blue-950 mt-0.5">Active Carts</h4>
          <div className="mt-3 text-2xl font-bold font-mono text-blue-900">
            {formatNumber(cart.usersWithCart || 0)}
          </div>
          <p className="text-[11px] text-blue-600 mt-2">Registered accounts with items in cart</p>
        </div>

        {/* Step 3: Checkout Initiations */}
        <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 relative">
          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Step 03</span>
          <h4 className="text-sm font-bold text-indigo-950 mt-0.5">Checkout Initiations</h4>
          <div className="mt-3 text-2xl font-bold font-mono text-indigo-900">
            {formatNumber(checkout.checkoutInitiations || 0)}
          </div>
          <p className="text-[11px] text-indigo-600 mt-2">Completed OTP checkout verification requests</p>
        </div>

        {/* Step 4: Completed Orders */}
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 relative">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Step 04</span>
          <h4 className="text-sm font-bold text-emerald-950 mt-0.5">Confirmed Orders</h4>
          <div className="mt-3 text-2xl font-bold font-mono text-emerald-900">
            {formatNumber(orders.completedOrders || 0)}
          </div>
          <p className="text-[11px] text-emerald-600 mt-2">Verified qualifying orders in range</p>
        </div>
      </div>

      {/* Conversion Rate Highlight Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
        <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
              Checkout-to-Order Conversion
            </span>
            <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-3xl font-extrabold font-mono text-emerald-900 mt-2">
            {checkout.checkoutInitiationRate || 0}%
          </div>
          <p className="text-xs text-emerald-700 mt-1">
            Confirmed orders relative to checkout OTP sessions
          </p>
        </div>

        <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
              Cart Abandonment Rate
            </span>
            <CartIcon className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-3xl font-extrabold font-mono text-amber-900 mt-2">
            {cartAbandonment.cartAbandonmentRate || 0}%
          </div>
          <p className="text-xs text-amber-700 mt-1">
            Estimated uncompleted active carts: {formatNumber(cartAbandonment.abandonedCarts || 0)}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Add-to-Cart Conversion
            </span>
            <InfoCircleIcon className="w-5 h-5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-500 mt-2">
            N/A
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Requires visitor count to compute accurately without fabrication
          </p>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Primary Component: Dashboard
// =============================================================================

const Dashboard = () => {
  const { currency = '৳', axios } = useAppContext();

  // Primary Data States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);

  // Filter States
  const currentMonthStr = useMemo(() => getCurrentDhakaMonth(), []);
  const [filterMode, setFilterMode] = useState('month'); // 'month' | 'custom'
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [validationError, setValidationError] = useState(null);

  // Active Main Tab State
  const [activeTab, setActiveTab] = useState('sales'); // 'sales' | 'products' | 'orders' | 'conversion'
  // Active Timeframe for Sales Chart
  const [activeTimeframe, setActiveTimeframe] = useState('daily'); // 'daily' | 'weekly' | 'monthly' | 'yearly' | 'growth'

  // Abort controller reference
  const activeControllerRef = useRef(null);

  // Core fetch function
  const fetchAnalytics = useCallback(async (params = {}) => {
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
    }
    const controller = new AbortController();
    activeControllerRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get('/api/seller/analytics', {
        params,
        signal: controller.signal
      });

      if (data?.success && data?.data) {
        setAnalyticsData(data.data);
        if (data.data.range) {
          if (!customStartDate) setCustomStartDate(data.data.range.startDate);
          if (!customEndDate) setCustomEndDate(data.data.range.endDate);
        }
      } else {
        setError(data?.message || "Failed to load sales analytics");
      }
    } catch (err) {
      if (axios.isCancel(err) || err.name === 'CanceledError' || err.name === 'AbortError') {
        return;
      }
      const clientMessage =
        err.response?.data?.message ||
        (err.response?.status === 401
          ? "Unauthorized. Please log in as a seller."
          : "Unable to connect to the analytics server. Please try again.");
      setError(clientMessage);
    } finally {
      setLoading(false);
    }
  }, [axios, customStartDate, customEndDate]);

  useEffect(() => {
    fetchAnalytics({ month: selectedMonth });

    return () => {
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
      }
    };
  }, []);

  // Filter Handlers
  const handleMonthChange = (e) => {
    const val = e.target.value;
    setSelectedMonth(val);
    setValidationError(null);
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(val)) {
      fetchAnalytics({ month: val });
    }
  };

  const handleApplyCustomRange = (e) => {
    e.preventDefault();
    setValidationError(null);

    if (!customStartDate || !customEndDate) {
      setValidationError("Both start date and end date are required.");
      return;
    }
    if (customStartDate > customEndDate) {
      setValidationError("Start date cannot be after end date.");
      return;
    }

    const [sY, sM, sD] = customStartDate.split('-').map(Number);
    const [eY, eM, eD] = customEndDate.split('-').map(Number);
    const sUtc = Date.UTC(sY, sM - 1, sD);
    const eUtc = Date.UTC(eY, eM - 1, eD);
    const diffDays = Math.round((eUtc - sUtc) / 86400000) + 1;

    if (diffDays > 366) {
      setValidationError(`Selected range (${diffDays} days) exceeds maximum limit of 366 days.`);
      return;
    }

    fetchAnalytics({ startDate: customStartDate, endDate: customEndDate });
  };

  const handleResetThisMonth = () => {
    setFilterMode('month');
    setSelectedMonth(currentMonthStr);
    setValidationError(null);
    fetchAnalytics({ month: currentMonthStr });
  };

  const handleModeSwitch = (mode) => {
    if (mode === filterMode) return;
    setFilterMode(mode);
    setValidationError(null);

    if (mode === 'month') {
      fetchAnalytics({ month: selectedMonth });
    } else if (mode === 'custom' && customStartDate && customEndDate && customStartDate <= customEndDate) {
      fetchAnalytics({ startDate: customStartDate, endDate: customEndDate });
    }
  };

  const handleRefresh = () => {
    if (filterMode === 'month') {
      fetchAnalytics({ month: selectedMonth });
    } else if (filterMode === 'custom' && customStartDate && customEndDate) {
      fetchAnalytics({ startDate: customStartDate, endDate: customEndDate });
    } else {
      fetchAnalytics();
    }
  };

  // Safe data extraction
  const kpis = analyticsData?.kpis || {};
  const totalUsers = typeof kpis.totalUsers === 'number' ? kpis.totalUsers : 0;
  const totalOrders = typeof kpis.totalOrders === 'number' ? kpis.totalOrders : 0;
  const totalRevenue = typeof kpis.totalRevenue === 'number' ? kpis.totalRevenue : (kpis.totalSales || 0);
  const totalPendingOrders = typeof kpis.totalPendingOrders === 'number' ? kpis.totalPendingOrders : 0;
  const averageOrderValue = typeof kpis.averageOrderValue === 'number' ? kpis.averageOrderValue : 0;
  const salesGrowth = kpis.salesGrowth || { rate: 0, isPositive: true };

  const todayOrders = kpis.todayOrders || { count: 0, yesterdayCount: 0, growthRate: 0, diffCount: 0, isPositive: true };
  const todayOrdersCount = typeof todayOrders.count === 'number' ? todayOrders.count : 0;
  const todayOrdersDiff = typeof todayOrders.diffCount === 'number' ? todayOrders.diffCount : 0;

  const totalCustomersCount = typeof kpis.totalCustomers === 'number' ? kpis.totalCustomers : totalUsers;
  const newCustomersTodayCount = typeof kpis.newCustomersToday === 'number' ? kpis.newCustomersToday : (kpis.customerGrowth?.newToday || 0);

  const sparklines = kpis.sparklines || {};

  const range = analyticsData?.range;
  const isolation = analyticsData?.isolation || { isStoreAdmin: true };
  const sales = analyticsData?.sales || {};
  const products = analyticsData?.products || {};
  const orders = analyticsData?.orders || {};
  const conversion = analyticsData?.conversion || {};
  const productBreakdown = analyticsData?.productBreakdown || [];

  // Active chart series based on selected timeframe
  const activeSeries = useMemo(() => {
    if (activeTimeframe === 'daily') return sales.daily || analyticsData?.dailySales || [];
    if (activeTimeframe === 'weekly') return sales.weekly || [];
    if (activeTimeframe === 'monthly') return sales.monthly || [];
    if (activeTimeframe === 'yearly') return sales.yearly || [];
    if (activeTimeframe === 'growth') return sales.growth || [];
    return sales.daily || [];
  }, [activeTimeframe, sales, analyticsData]);

  const kpiSalesSparkline = useMemo(() => {
    if (sales.daily && sales.daily.length > 0) return sales.daily.slice(-14).map(d => d.sales || 0);
    if (analyticsData?.dailySales && analyticsData.dailySales.length > 0) return analyticsData.dailySales.slice(-14).map(d => d.sales || 0);
    return sparklines.sales || [];
  }, [sales, analyticsData, sparklines]);

  const kpiOrdersSparkline = useMemo(() => {
    if (sales.daily && sales.daily.length > 0) return sales.daily.slice(-10).map(d => d.orderCount || 0);
    if (analyticsData?.dailySales && analyticsData.dailySales.length > 0) return analyticsData.dailySales.slice(-10).map(d => d.orderCount || 0);
    return sparklines.orders || [];
  }, [sales, analyticsData, sparklines]);

  const kpiCustomerSparkline = useMemo(() => {
    if (sales.daily && sales.daily.length > 0) return sales.daily.slice(-14).map(d => d.orderCount || 0);
    return [];
  }, [sales]);

  // Export dropdown state
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setExportMenuOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setExportMenuOpen(false);
    };
    if (exportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [exportMenuOpen]);

  const handleExportCsv = () => {
    setExportMenuOpen(false);
    if (!analyticsData || !range) {
      toast.error("Analytics data is not available to export.");
      return;
    }

    try {
      const csvContent = buildAnalyticsCsv({
        range,
        kpis,
        dailySales: sales.daily || analyticsData?.dailySales || [],
        productBreakdown,
        orders,
        conversion,
        currency,
        totalSales: totalRevenue
      });

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `greencart-analytics-${range.startDate}-to-${range.endDate}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("CSV analytics report downloaded");
    } catch (err) {
      console.error("CSV Export failed:", err);
      toast.error("Failed to generate CSV export.");
    }
  };

  const handleExportExcel = () => {
    setExportMenuOpen(false);
    if (!analyticsData || !range) {
      toast.error("Analytics data is not available to export.");
      return;
    }

    try {
      const xmlContent = buildAnalyticsSpreadsheetXml({
        range,
        kpis,
        dailySales: sales.daily || analyticsData?.dailySales || [],
        productBreakdown,
        orders,
        currency,
        totalSales: totalRevenue
      });

      const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `greencart-analytics-${range.startDate}-to-${range.endDate}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Excel workbook (.xls) downloaded");
    } catch (err) {
      console.error("Excel Export failed:", err);
      toast.error("Failed to generate Excel export.");
    }
  };

  const handlePrintReport = () => {
    setExportMenuOpen(false);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return (
    <div className="no-scrollbar flex-1 h-[95vh] overflow-y-scroll p-4 md:p-8 bg-slate-50/70 font-sans">
      {/* Scope Badge & Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Advanced Analytics Dashboard
            </h1>

            {/* Admin / Seller Scope Indicator Badge */}
            {isolation.isStoreAdmin ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                <ShieldCheckIcon className="w-3.5 h-3.5 text-blue-600" />
                Store-Wide Platform View (Admin)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
                <PackageIcon className="w-3.5 h-3.5 text-purple-600" />
                Seller Storefront View (Isolated)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isolation.isStoreAdmin
              ? 'Aggregated cross-vendor commerce metrics and store-wide financial performance'
              : 'Strictly isolated to your authorized seller inventory, customer orders, and revenue'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 self-start lg:self-auto">
          {/* Export Dropdown */}
          <div className="relative inline-block text-left" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setExportMenuOpen((prev) => !prev)}
              disabled={loading || !analyticsData}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl shadow-xs hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <DownloadIcon className="w-4 h-4 text-slate-500" />
              <span>Export</span>
              <ChevronDownIcon className={`w-3.5 h-3.5 text-slate-400 transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {exportMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white shadow-xl border border-slate-200 py-2 z-50 text-xs">
                <div className="px-4 py-2 border-b border-slate-100">
                  <span className="font-bold text-slate-800 block">Export Analytics Report</span>
                  <span className="text-[11px] text-slate-400">{range?.startDate} to {range?.endDate}</span>
                </div>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-start gap-3 transition-colors cursor-pointer"
                >
                  <FileCsvIcon className="w-4 h-4 text-emerald-600 mt-0.5" />
                  <div>
                    <div className="font-semibold text-slate-800">Download CSV Data</div>
                    <div className="text-[10px] text-slate-400">Comma-separated tabular dataset</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-start gap-3 transition-colors cursor-pointer"
                >
                  <FileExcelIcon className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div>
                    <div className="font-semibold text-slate-800">Download Excel Workbook</div>
                    <div className="text-[10px] text-slate-400">SpreadsheetML with 3 worksheets</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={handlePrintReport}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-start gap-3 transition-colors cursor-pointer border-t border-slate-100"
                >
                  <PrinterIcon className="w-4 h-4 text-indigo-600 mt-0.5" />
                  <div>
                    <div className="font-semibold text-slate-800">Print / PDF Report</div>
                    <div className="text-[10px] text-slate-400">Formatted executive printable view</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl shadow-xs hover:bg-slate-50 disabled:opacity-50 transition-all cursor-pointer"
          >
            <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl self-start">
            <button
              type="button"
              onClick={() => handleModeSwitch('month')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                filterMode === 'month' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Month Selector
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('custom')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                filterMode === 'custom' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Custom Date Range
            </button>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {filterMode === 'month' ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Select Month:</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={handleMonthChange}
                  className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white shadow-xs focus:ring-2 focus:ring-emerald-500/20 text-slate-800 cursor-pointer"
                />
              </div>
            ) : (
              <form onSubmit={handleApplyCustomRange} className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500 font-medium">From:</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => { setCustomStartDate(e.target.value); setValidationError(null); }}
                    className="px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-800"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500 font-medium">To:</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => { setCustomEndDate(e.target.value); setValidationError(null); }}
                    className="px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-800"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  Apply
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={handleResetThisMonth}
              disabled={filterMode === 'month' && selectedMonth === currentMonthStr}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer disabled:opacity-40"
            >
              <CalendarIcon className="w-3.5 h-3.5 text-slate-500" />
              <span>This Month</span>
            </button>
          </div>
        </div>

        {validationError && (
          <div className="mt-3 pt-3 border-t border-rose-100 text-xs text-rose-600 font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block"></span>
            <span>{validationError}</span>
          </div>
        )}
      </div>

      {/* Network / Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertIcon />
            <div>
              <h3 className="text-sm font-bold text-rose-800">Failed to load analytics</h3>
              <p className="text-xs text-rose-700 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Section 1: Prominent KPI Analytics Cards */}
      {loading && !analyticsData ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs animate-pulse flex flex-col justify-between h-44">
              <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                <div className="min-w-0 flex-1 flex flex-wrap items-center gap-1.5 sm:gap-2 pt-0.5">
                  <div className="h-3.5 bg-slate-200 rounded w-20 shrink-0"></div>
                  <div className="h-4 bg-slate-100 rounded-full w-14 shrink-0"></div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-200 shrink-0"></div>
              </div>
              <div className="space-y-2 mt-4">
                <div className="h-7 bg-slate-200 rounded w-32"></div>
                <div className="h-3 bg-slate-200 rounded w-20"></div>
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="h-3 bg-slate-200 rounded w-28"></div>
                <div className="h-3 bg-slate-200 rounded w-16"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-8">
          {/* ==================================================================== */}
          {/* CARD 1: Total Sales */}
          {/* ==================================================================== */}
          <div className="relative overflow-hidden bg-gradient-to-b from-white to-slate-50/60 border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col justify-between group">
            <div>
              <KpiCardHeader
                title="Total Sales"
                icon={SalesIcon}
                iconBg="from-emerald-50 to-teal-50"
                iconColor="text-emerald-600"
                iconBorder="border-emerald-200/60"
                badge={
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70 whitespace-nowrap truncate max-w-full"
                    title={range?.startDate && range?.endDate ? `Reporting Period: ${range.startDate} to ${range.endDate}` : 'Verified Sales'}
                  >
                    {range?.startDate && range?.endDate
                      ? `${formatShortDate(range.startDate)} - ${formatShortDate(range.endDate)}`
                      : 'Verified'}
                  </span>
                }
              />

              <div className="mt-4 flex items-baseline justify-between gap-2">
                <div className="text-2xl md:text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
                  {formatCurrency(totalRevenue, currency)}
                </div>
                <KpiSparkline data={kpiSalesSparkline} color="emerald" width={84} height={32} />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                    salesGrowth.isPositive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {salesGrowth.isPositive ? (
                    <TrendingUpIcon className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDownIcon className="w-3.5 h-3.5" />
                  )}
                  {salesGrowth.rate >= 0 ? `+${salesGrowth.rate}%` : `${salesGrowth.rate}%`}
                </span>
                <span className="text-[11px] text-slate-400">vs prior period</span>
              </div>
              {salesGrowth.priorPeriodSales > 0 && (
                <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                  Prior: {formatCompactCurrency(salesGrowth.priorPeriodSales, currency)}
                </span>
              )}
            </div>
          </div>

          {/* ==================================================================== */}
          {/* CARD 2: Today's Orders (Asia/Dhaka) */}
          {/* ==================================================================== */}
          <div className="relative overflow-hidden bg-gradient-to-b from-white to-slate-50/60 border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col justify-between group">
            <div>
              <KpiCardHeader
                title="Today's Orders"
                icon={OrdersIcon}
                iconBg="from-blue-50 to-indigo-50"
                iconColor="text-blue-600"
                iconBorder="border-blue-200/60"
                badge={
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/70 whitespace-nowrap truncate max-w-full"
                    title="Calculated in Asia/Dhaka Bangladesh Timezone (BST, UTC+6)"
                  >
                    Today (BST)
                  </span>
                }
              />

              <div className="mt-4 flex items-baseline justify-between gap-2">
                <div className="text-2xl md:text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
                  {formatNumber(todayOrdersCount)}
                  <span className="text-sm font-semibold text-slate-500 ml-1.5 font-sans">orders</span>
                </div>
                <KpiBarSparkline data={kpiOrdersSparkline} color="blue" width={84} height={32} />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                    todayOrdersDiff >= 0
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {todayOrdersDiff >= 0 ? (
                    <TrendingUpIcon className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDownIcon className="w-3.5 h-3.5" />
                  )}
                  {todayOrdersDiff >= 0 ? `+${todayOrdersDiff}` : `${todayOrdersDiff}`} vs yesterday
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                {formatNumber(totalOrders)} in period
              </span>
            </div>
          </div>

          {/* ==================================================================== */}
          {/* CARD 3: Total Customers */}
          {/* ==================================================================== */}
          <div className="relative overflow-hidden bg-gradient-to-b from-white to-slate-50/60 border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col justify-between group">
            <div>
              <KpiCardHeader
                title="Total Customers"
                icon={UsersIcon}
                iconBg="from-purple-50 to-violet-50"
                iconColor="text-purple-600"
                iconBorder="border-purple-200/60"
                badge={
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/70 whitespace-nowrap truncate max-w-full"
                    title="Unique verified customers from Customer Directory"
                  >
                    Directory
                  </span>
                }
              />

              <div className="mt-4 flex items-baseline justify-between gap-2">
                <div className="text-2xl md:text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
                  {formatNumber(totalCustomersCount)}
                  <span className="text-sm font-semibold text-slate-500 ml-1.5 font-sans">unique</span>
                </div>
                <KpiSparkline data={kpiCustomerSparkline} color="purple" width={84} height={32} />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              {newCustomersTodayCount > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                  +{newCustomersTodayCount} new today
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200/70">
                  Active Directory
                </span>
              )}
              <span className="text-[11px] text-slate-400">
                {formatNumber(totalUsers)} accounts
              </span>
            </div>
          </div>

          {/* ==================================================================== */}
          {/* CARD 4: Pending Orders */}
          {/* ==================================================================== */}
          <div className="relative overflow-hidden bg-gradient-to-b from-white to-slate-50/60 border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col justify-between group">
            <div>
              <KpiCardHeader
                title="Pending Orders"
                icon={PendingIcon}
                iconBg="from-amber-50 to-orange-50"
                iconColor="text-amber-600"
                iconBorder="border-amber-200/60"
                badge={
                  totalPendingOrders === 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70 whitespace-nowrap truncate max-w-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="truncate">Queue Clear</span>
                    </span>
                  ) : totalPendingOrders <= 5 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/70 whitespace-nowrap truncate max-w-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                      <span className="truncate">Active Queue</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/70 whitespace-nowrap truncate max-w-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                      <span className="truncate">Action Needed</span>
                    </span>
                  )
                }
              />

              <div className="mt-4 flex items-baseline justify-between gap-2">
                <div className="text-2xl md:text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
                  {formatNumber(totalPendingOrders)}
                  <span className="text-sm font-semibold text-slate-500 ml-1.5 font-sans">awaiting</span>
                </div>
                {/* Compact Fulfillment Queue Progress Bar */}
                <div
                  className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60 shrink-0"
                  title={`Pending: ${totalPendingOrders} / Total: ${totalOrders}`}
                >
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      totalPendingOrders === 0 ? 'bg-emerald-500 w-full' : 'bg-amber-500'
                    }`}
                    style={{
                      width: totalOrders > 0 ? `${Math.min(100, Math.max(10, (totalPendingOrders / totalOrders) * 100))}%` : '0%'
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <Link
                to="/seller/orders"
                className="inline-flex items-center gap-1 font-semibold text-amber-700 hover:text-amber-800 transition-colors group-hover:underline cursor-pointer"
              >
                <span>View Pending Queue</span>
                <span className="text-sm leading-none">→</span>
              </Link>
              <span className="text-[11px] text-slate-400">
                {totalOrders > 0 ? `${Math.round((totalPendingOrders / totalOrders) * 100)}% of orders` : 'No orders'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Feature Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-6 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('sales')}
          className={`pb-3 px-3 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'sales'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <TrendingUpIcon className="w-4 h-4" />
          <span>Sales Analytics</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('products')}
          className={`pb-3 px-3 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'products'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <PackageIcon className="w-4 h-4" />
          <span>Product Performance</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`pb-3 px-3 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'orders'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <OrdersIcon className="w-4 h-4" />
          <span>Order Pipeline</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('conversion')}
          className={`pb-3 px-3 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'conversion'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FunnelIcon className="w-4 h-4" />
          <span>Conversion Funnel</span>
        </button>
      </div>

      {/* Tab 1: Sales Analytics */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          {/* Timeframe Selector Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-bold text-slate-600">Aggregation Granularity:</span>
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTimeframe('daily')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTimeframe === 'daily'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Daily Sales
              </button>
              <button
                type="button"
                onClick={() => setActiveTimeframe('weekly')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTimeframe === 'weekly'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Weekly Sales
              </button>
              <button
                type="button"
                onClick={() => setActiveTimeframe('monthly')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTimeframe === 'monthly'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Monthly Sales
              </button>
              <button
                type="button"
                onClick={() => setActiveTimeframe('yearly')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTimeframe === 'yearly'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Yearly Sales
              </button>
              <button
                type="button"
                onClick={() => setActiveTimeframe('growth')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTimeframe === 'growth'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-indigo-700 hover:text-indigo-900'
                }`}
              >
                Growth Trend Chart
              </button>
            </div>
          </div>

          {/* Interactive Native SVG Chart */}
          <InteractiveChart
            data={activeSeries}
            timeframe={activeTimeframe}
            currency={currency}
            loading={loading}
            totalSales={totalRevenue}
            totalOrders={totalOrders}
            range={range}
          />
        </div>
      )}

      {/* Tab 2: Product Performance */}
      {activeTab === 'products' && (
        <ProductPerformance
          productsData={products}
          totalSales={totalRevenue}
          currency={currency}
        />
      )}

      {/* Tab 3: Order Pipeline */}
      {activeTab === 'orders' && (
        <OrderAnalytics
          ordersData={orders}
          currency={currency}
        />
      )}

      {/* Tab 4: Conversion Funnel */}
      {activeTab === 'conversion' && (
        <ConversionFunnel
          conversionData={conversion}
        />
      )}

      {/* Corporate Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 pt-8 border-t border-slate-200 mt-10">
        <span>GreenCart Commercial Analytics Engine • Active Session</span>
        <span>Verified Order Basis: Cash-on-Delivery (COD) &amp; Paid Online Orders</span>
      </div>
    </div>
  );
};

export default Dashboard;
