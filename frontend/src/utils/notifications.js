import {
    BellIcon,
    CheckCircleIcon,
    CreditCardIcon,
    CubeIcon,
    HomeIcon,
    ShoppingBagIcon,
    TruckIcon,
    XCircleIcon,
} from "@heroicons/vue/24/outline";

// One icon per NotificationType (backend enum); BellIcon for any new type.
const ICONS = {
    ORDER_PLACED: ShoppingBagIcon,
    PAYMENT_RECEIVED: CreditCardIcon,
    ORDER_CONFIRMED: CheckCircleIcon,
    ORDER_PROCESSING: CubeIcon,
    ORDER_SHIPPED: TruckIcon,
    ORDER_DELIVERED: HomeIcon,
    ORDER_CANCELLED: XCircleIcon,
};

export const notificationIcon = (type) => ICONS[type] ?? BellIcon;

// The badge never grows past three characters.
export const formatUnreadBadge = (count) => (count > 99 ? "99+" : String(count));

// The existing order details route, for notifications about an order.
export const notificationRoute = (notification) => (notification.orderId
    ? { name: "order-details", params: { id: notification.orderId } }
    : null);

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const fullDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

// Largest first: the first unit that fits is used.
const UNITS = [
    ["day", 24 * 60 * 60],
    ["hour", 60 * 60],
    ["minute", 60],
];

// "just now", "5 minutes ago", "yesterday"; a date after a week.
export function formatRelativeTime(value, now = Date.now()) {
    const date = new Date(value);
    const seconds = Math.round((date.getTime() - now) / 1000);

    if (Number.isNaN(seconds)) return "";
    if (Math.abs(seconds) < 60) return "just now";
    if (Math.abs(seconds) >= 7 * 24 * 60 * 60) return fullDate.format(date);

    const [unit, size] = UNITS.find(([, unitSeconds]) => Math.abs(seconds) >= unitSeconds);

    return relative.format(Math.round(seconds / size), unit);
}

// Full timestamp for the <time> tooltip.
export const formatFullTime = (value) => new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
