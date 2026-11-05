/**
 * International-Grade Formatting Engine for My Cockpit AI
 * Supports INR (Indian numbering system), USD, EUR, GBP, and ISO date formatting.
 */

export type SupportedCurrency = 'INR' | 'USD' | 'EUR' | 'GBP';
export type DateFormatStyle = 'short' | 'medium' | 'long' | 'relative';

/**
 * Format currency with proper localization and symbol placement.
 */
export function formatCurrency(
  amount: number | string | null | undefined, 
  currency: SupportedCurrency = 'INR'
): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  if (isNaN(num)) return currency === 'INR' ? '₹0' : '$0.00';

  try {
    const locale = currency === 'INR' ? 'en-IN' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: currency === 'INR' ? 0 : 2,
      minimumFractionDigits: 0
    }).format(num);
  } catch {
    return `${currency === 'INR' ? '₹' : '$'}${num.toLocaleString()}`;
  }
}

/**
 * Format large numbers with abbreviations (e.g., ₹1.2L, ₹2.5Cr or $1.2M)
 */
export function formatCompactCurrency(
  amount: number | string | null | undefined,
  currency: SupportedCurrency = 'INR'
): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  if (isNaN(num) || num === 0) return currency === 'INR' ? '₹0' : '$0';

  if (currency === 'INR') {
    if (num >= 10000000) {
      return `₹${(num / 10000000).toFixed(1).replace(/\.0$/, '')} Cr`;
    }
    if (num >= 100000) {
      return `₹${(num / 100000).toFixed(1).replace(/\.0$/, '')} L`;
    }
    if (num >= 1000) {
      return `₹${(num / 1000).toFixed(0)}k`;
    }
    return `₹${num}`;
  }

  // Western formatting (USD, EUR)
  if (num >= 1000000) {
    return `${currency === 'EUR' ? '€' : '$'}${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${currency === 'EUR' ? '€' : '$'}${(num / 1000).toFixed(1)}k`;
  }
  return `${currency === 'EUR' ? '€' : '$'}${num}`;
}

/**
 * Format standard dates consistently
 */
export function formatDate(
  dateInput: string | Date | null | undefined,
  style: DateFormatStyle = 'medium'
): string {
  if (!dateInput) return '—';
  const date = typeof dateInput === 'string' ? new Date(dateInput.replace(' ', 'T')) : dateInput;
  if (isNaN(date.getTime())) return String(dateInput);

  if (style === 'relative') {
    return formatRelativeTime(date);
  }

  const optionsMap: Record<string, Intl.DateTimeFormatOptions> = {
    short: { day: '2-digit', month: '2-digit', year: 'numeric' },
    medium: { day: 'numeric', month: 'short', year: 'numeric' },
    long: { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }
  };

  return new Intl.DateTimeFormat('en-IN', optionsMap[style] || optionsMap.medium).format(date);
}

/**
 * Human-friendly relative time (e.g. "Just now", "5m ago", "Tomorrow")
 */
export function formatRelativeTime(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput.replace(' ', 'T')) : dateInput;
  if (isNaN(date.getTime())) return String(dateInput);

  const now = new Date();
  const diffSec = Math.round((date.getTime() - now.getTime()) / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHours = Math.round(diffMin / 60);
  const diffDays = Math.round(diffHours / 24);

  if (Math.abs(diffSec) < 60) return 'Just now';
  if (diffSec < 0) {
    // Past
    if (Math.abs(diffMin) < 60) return `${Math.abs(diffMin)}m ago`;
    if (Math.abs(diffHours) < 24) return `${Math.abs(diffHours)}h ago`;
    if (Math.abs(diffDays) === 1) return 'Yesterday';
    if (Math.abs(diffDays) < 30) return `${Math.abs(diffDays)}d ago`;
    return formatDate(date, 'medium');
  } else {
    // Future
    if (diffMin < 60) return `In ${diffMin}m`;
    if (diffHours < 24) return `In ${diffHours}h`;
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 30) return `In ${diffDays}d`;
    return formatDate(date, 'medium');
  }
}

/**
 * Clean phone number for tel: links
 */
export function cleanPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/[^\d+]/g, '');
}

/**
 * Generate click-to-WhatsApp link with encoded message
 */
export function createWhatsAppUrl(phone: string | null | undefined, message = ''): string {
  const clean = cleanPhoneNumber(phone).replace(/^\+/, '');
  if (!clean) return '#';
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

