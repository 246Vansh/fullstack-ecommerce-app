// Admin user management (pages/admin/adminUsersPage.vue): list query parsing,
// search checks, display labels, which actions a row offers, and the wording
// of confirmations. These only shape the UI: the API (/api/admin/users)
// enforces every rule again, including who may act on which account.
// No import.meta.env or Vue here, so Node tests can import it.

// Match the API (services/adminUserService.js and routes/adminRoutes.js).
export const USER_ROLES = ["CUSTOMER", "ADMIN"];
export const USER_STATUSES = ["active", "blocked", "deleted"];
export const MAX_SEARCH_LENGTH = 100;
export const MAX_SEARCH_WORDS = 5;
const MAX_PAGE = 10_000;

const ROLE_LABELS = { ADMIN: "Admin", CUSTOMER: "Customer" };
export const STATUS_LABELS = { active: "Active", blocked: "Blocked", deleted: "Deleted" };

export const roleLabel = (role) => ROLE_LABELS[role] ?? role;

export function fullName(user) {
    return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
}

// "" when the API would accept the search, otherwise why not.
export function searchError(value) {
    const search = String(value ?? "").trim();

    if (search.length > MAX_SEARCH_LENGTH) return `Search must be at most ${MAX_SEARCH_LENGTH} characters.`;
    if (/[%\\]/.test(search)) return "Search must not contain % or \\.";
    if (search.split(/\s+/).filter(Boolean).length > MAX_SEARCH_WORDS) return `Search must be at most ${MAX_SEARCH_WORDS} words.`;

    return "";
}

const single = (value) => (typeof value === "string" ? value : "");

// The page's state lives in the URL (?search=&role=&status=&page=), so reload
// and back/forward work. Malformed values fall back instead of reaching the API.
export function listQueryFrom(query) {
    const page = single(query.page);
    const search = single(query.search).trim();
    const role = single(query.role);
    const status = single(query.status);

    return {
        page: /^[1-9]\d{0,4}$/.test(page) && Number(page) <= MAX_PAGE ? Number(page) : 1,
        search: searchError(search) ? "" : search,
        role: USER_ROLES.includes(role) ? role : "",
        status: USER_STATUSES.includes(status) ? status : "",
    };
}

export function apiParamsFrom({ page, search, role, status }, limit) {
    return {
        page,
        limit,
        ...(search && { search }),
        ...(role && { role }),
        ...(status && { status }),
    };
}

// Deleted wins over blocked: a deleted account is gone, whatever it was before.
export function accountStatus(user) {
    if (user.isDeleted) return { key: "deleted", label: STATUS_LABELS.deleted, tone: "neutral" };
    if (user.blockedAt) return { key: "blocked", label: STATUS_LABELS.blocked, tone: "danger" };
    return { key: "active", label: STATUS_LABELS.active, tone: "success" };
}

export function emptyListMessage({ search, role, status }) {
    return search || role || status
        ? "No accounts match these filters. Try another search or show all accounts."
        : "There are no accounts yet.";
}

// What a row offers the signed-in admin (currentUserId). Mirrors the API:
// never your own account or a deleted one; only customers are blocked; only
// unblocked customers are promoted; admins can only be demoted.
export function userActions(user, currentUserId) {
    const none = { canBlock: false, canUnblock: false, canPromote: false, canDemote: false };

    if (currentUserId === undefined || currentUserId === null) return { isSelf: false, ...none, reason: "" };
    if (user.id === currentUserId) return { isSelf: true, ...none, reason: "This is your account" };
    if (user.isDeleted) return { isSelf: false, ...none, reason: "Deleted account" };

    const customer = user.role === "CUSTOMER";
    const blocked = Boolean(user.blockedAt);

    return {
        isSelf: false,
        canBlock: customer && !blocked,
        canUnblock: blocked,
        canPromote: customer && !blocked,
        canDemote: user.role === "ADMIN",
        reason: "",
    };
}

const who = (user) => `${fullName(user)} (${user.email})`;

export const blockConfirmation = (user) =>
    `Block ${who(user)}? They are signed out everywhere at once and cannot sign in until you unblock them. Their orders are not changed.`;

export const unblockConfirmation = (user) =>
    `Unblock ${who(user)}? They will be able to sign in again.`;

// Wording for the role-change dialog. Promotion needs an explicit
// acknowledgement (a checkbox) before it can be submitted.
export function roleChangeCopy(user, role) {
    const name = fullName(user);

    if (role === "ADMIN") {
        return {
            promoting: true,
            title: `Make ${name} an administrator?`,
            description: `${user.email} will be signed out, and after signing in again can manage products, orders, coupons and customers.`,
            acknowledgement: `I understand ${name} will get full admin access to this store.`,
            submitLabel: "Make admin",
            success: `${name} is now an administrator. They were signed out and must sign in again.`,
        };
    }

    return {
        promoting: false,
        title: `Remove admin access from ${name}?`,
        description: `${user.email} will be signed out and become a customer. Their orders and account are kept.`,
        acknowledgement: "",
        submitLabel: "Remove admin access",
        success: `${name} is now a customer. They were signed out.`,
    };
}
