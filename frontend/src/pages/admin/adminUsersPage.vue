<template>
    <div class="mx-auto max-w-7xl">

        <AdminPageHeader title="Customers"
            description="Every account, newest first. Block customers, or change who is an administrator." />

        <!-- Search + filters. Stays usable on the 403 screen, so a later successful load can clear it. -->
        <form class="mt-6 flex flex-col gap-3 rounded-card border border-slate-200 bg-white p-4 shadow-card lg:flex-row lg:items-start"
            role="search" aria-label="Filter accounts" novalidate @submit.prevent="applySearch">
            <div class="min-w-0 flex-1">
                <label for="user-search" class="block text-sm font-medium text-slate-900">Search by name or email</label>
                <input id="user-search" v-model="searchInput" type="search" :maxlength="MAX_SEARCH_LENGTH" autocomplete="off" spellcheck="false"
                    :aria-invalid="searchMessage ? 'true' : undefined" :aria-describedby="searchMessage ? 'user-search-error' : undefined"
                    class="mt-1.5 block min-h-11 w-full rounded-control border bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-3 sm:text-sm"
                    :class="searchMessage ? 'border-red-600 focus:border-red-600 focus:ring-red-600/20' : 'border-slate-300 hover:border-slate-400 focus:border-brand focus:ring-brand/20'"
                    placeholder="e.g. Ada Lovelace or ada@example.com" />
                <p v-if="searchMessage" id="user-search-error" class="mt-1.5 text-xs font-medium text-red-700">{{ searchMessage }}</p>
            </div>
            <div class="lg:w-40">
                <label for="user-role-filter" class="block text-sm font-medium text-slate-900">Role</label>
                <select id="user-role-filter" :value="query.role" :class="selectClass" @change="setFilter('role', $event.target.value)">
                    <option value="">All roles</option>
                    <option v-for="value in USER_ROLES" :key="value" :value="value">{{ roleLabel(value) }}</option>
                </select>
            </div>
            <div class="lg:w-44">
                <label for="user-status-filter" class="block text-sm font-medium text-slate-900">Account status</label>
                <select id="user-status-filter" :value="query.status" :class="selectClass" @change="setFilter('status', $event.target.value)">
                    <option value="">Active and blocked</option>
                    <option v-for="value in USER_STATUSES" :key="value" :value="value">{{ STATUS_LABELS[value] }} only</option>
                </select>
            </div>
            <PrimaryButton tag="button" type="submit" variant="outline" class="lg:mt-7 lg:w-auto">Search</PrimaryButton>
        </form>

        <!-- Access revoked server-side (403). -->
        <AdminStatePanel v-if="forbidden" kind="forbidden" class="mt-4" title="Admin access required"
            message="The server did not accept your account as an administrator. If your access changed recently, sign out and sign in again." />

        <template v-else>

            <!-- Announces load results and actions without moving focus -->
            <p class="sr-only" aria-live="polite">{{ liveMessage }}</p>

            <!-- First load: nothing to show yet -->
            <AdminStatePanel v-if="loading && !pagination" kind="loading" class="mt-4" title="Loading accounts" />

            <!-- Error -->
            <AdminStatePanel v-else-if="error" kind="error" class="mt-4" title="Accounts unavailable" :message="error">
                <PrimaryButton tag="button" variant="outline" :loading="loading" @click="load">
                    {{ loading ? "Retrying…" : "Try again" }}
                </PrimaryButton>
            </AdminStatePanel>

            <!-- Empty -->
            <AdminStatePanel v-else-if="!users.length" kind="empty" class="mt-4" :icon="UsersIcon"
                :title="filtered ? 'No accounts match' : 'No accounts'" :message="emptyListMessage(query)">
                <PrimaryButton v-if="filtered" tag="button" variant="outline" @click="clearFilters">Show all accounts</PrimaryButton>
            </AdminStatePanel>

            <!-- List (kept on screen, dimmed, while the next page loads) -->
            <section v-else class="mt-4" :aria-busy="loading" aria-labelledby="admin-users-range">

                <p id="admin-users-range" tabindex="-1" class="mb-3 text-sm text-slate-600 focus:outline-none">{{ rangeText }}</p>

                <div class="overflow-hidden rounded-card border border-slate-200 bg-white shadow-card transition-opacity"
                    :class="{ 'pointer-events-none opacity-60': loading }">

                    <!-- Column headings (visual only; each row labels its fields for phones and screen readers). -->
                    <div aria-hidden="true" :class="[GRID, 'hidden border-b border-slate-200 bg-slate-50 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 lg:grid']">
                        <span>Account</span>
                        <span>Role</span>
                        <span>Status</span>
                        <span>Registered</span>
                        <span class="text-right">Orders</span>
                        <span class="text-right">Actions</span>
                    </div>

                    <ul class="divide-y divide-slate-100">
                        <li v-for="user in users" :key="user.id">
                            <div :class="[GRID, 'grid grid-cols-[minmax(0,1fr)_auto] gap-y-2 py-4 lg:items-center']">

                                <!-- Account -->
                                <div class="min-w-0">
                                    <p class="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                                        <span class="wrap-anywhere">{{ fullName(user) }}</span>
                                        <AdminBadge v-if="actionsFor(user).isSelf" tone="brand">You</AdminBadge>
                                    </p>
                                    <p class="truncate text-sm text-slate-600">{{ user.email }}</p>
                                </div>

                                <!-- Role + status: top-right on phones/tablets -->
                                <div class="flex flex-col items-end gap-1.5 lg:hidden">
                                    <AdminBadge :tone="user.role === 'ADMIN' ? 'brand' : 'neutral'">{{ roleLabel(user.role) }}</AdminBadge>
                                    <AdminBadge :tone="accountStatus(user).tone">{{ accountStatus(user).label }}</AdminBadge>
                                </div>

                                <div class="hidden lg:block">
                                    <span class="sr-only">Role: </span>
                                    <AdminBadge :tone="user.role === 'ADMIN' ? 'brand' : 'neutral'">{{ roleLabel(user.role) }}</AdminBadge>
                                </div>
                                <div class="hidden lg:block">
                                    <span class="sr-only">Status: </span>
                                    <AdminBadge :tone="accountStatus(user).tone">{{ accountStatus(user).label }}</AdminBadge>
                                </div>

                                <!-- Registered + orders -->
                                <p class="text-sm text-slate-600">
                                    <span class="lg:hidden">Registered </span>{{ formatDate(user.createdAt) }}
                                </p>
                                <p class="text-right text-sm tabular-nums text-slate-900">
                                    {{ user.orderCount }}<span class="lg:sr-only"> {{ user.orderCount === 1 ? "order" : "orders" }}</span>
                                </p>

                                <!-- Actions. The server re-checks each one; these only hide what it would refuse. -->
                                <div class="col-span-2 flex flex-wrap items-center gap-2 lg:col-span-1 lg:justify-end">
                                    <p v-if="user.isDeleted" class="text-sm text-slate-500">Deleted account · no actions</p>
                                    <template v-else>
                                        <button v-if="user.role === 'CUSTOMER'" :id="`user-${user.id}-block`" type="button"
                                            :disabled="busy || !(user.blockedAt ? actionsFor(user).canUnblock : actionsFor(user).canBlock)"
                                            :aria-describedby="hintFor(user) ? `user-${user.id}-hint` : undefined"
                                            :class="user.blockedAt ? buttonClass : dangerClass" @click="toggleBlock(user)">
                                            {{ user.blockedAt ? "Unblock" : "Block" }}<span class="sr-only"> {{ fullName(user) }}</span>
                                        </button>
                                        <button :id="`user-${user.id}-role`" type="button"
                                            :disabled="busy || !(user.role === 'ADMIN' ? actionsFor(user).canDemote : actionsFor(user).canPromote)"
                                            :aria-describedby="hintFor(user) ? `user-${user.id}-hint` : undefined"
                                            :class="buttonClass" @click="openRoleDialog(user)">
                                            {{ user.role === "ADMIN" ? "Remove admin access" : "Make admin" }}<span class="sr-only"> for {{ fullName(user) }}</span>
                                        </button>
                                        <p v-if="hintFor(user)" :id="`user-${user.id}-hint`" class="w-full text-xs text-slate-500 lg:text-right">
                                            {{ hintFor(user) }}
                                        </p>
                                    </template>
                                </div>
                            </div>

                            <div v-if="rowFor === user.id && (rowSave.alert.value || rowSave.success.value)" class="px-4 pb-4 sm:px-5">
                                <AdminFormStatus :alert="rowSave.alert.value" :success="rowSave.success.value" />
                            </div>
                        </li>
                    </ul>
                </div>

                <Pagination v-if="pagination.totalPages > 1" class="mt-2" :model-value="pagination.page"
                    :total-pages="pagination.totalPages" @update:model-value="goToPage" />

            </section>

        </template>

        <!-- Role change: the signed-in admin's password, and for a promotion an
             explicit acknowledgement. The only password field on this page. -->
        <TransitionRoot as="template" :show="dialog.open" @after-leave="afterDialogLeave">
            <Dialog class="relative z-50" @close="closeDialog">
                <TransitionChild as="template" enter="transition-opacity ease-out duration-150" enter-from="opacity-0"
                    enter-to="opacity-100" leave="transition-opacity ease-in duration-100" leave-from="opacity-100" leave-to="opacity-0">
                    <div class="fixed inset-0 bg-slate-900/40"></div>
                </TransitionChild>

                <div class="fixed inset-0 overflow-y-auto">
                    <div class="flex min-h-full items-center justify-center p-4">
                        <TransitionChild as="template" enter="transition ease-out duration-150" enter-from="opacity-0 scale-95"
                            enter-to="opacity-100 scale-100" leave="transition ease-in duration-100" leave-from="opacity-100 scale-100"
                            leave-to="opacity-0 scale-95">
                            <DialogPanel v-if="dialog.user" class="w-full max-w-md rounded-card bg-white p-5 shadow-raised sm:p-6">
                                <DialogTitle class="text-lg font-semibold text-slate-900">{{ copy.title }}</DialogTitle>
                                <p class="mt-2 text-sm text-slate-600">{{ copy.description }}</p>

                                <form class="mt-5 space-y-4" novalidate @submit.prevent="submitRoleChange">
                                    <label v-if="copy.promoting" for="role-acknowledge"
                                        class="flex cursor-pointer items-start gap-3 rounded-control border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900">
                                        <input id="role-acknowledge" v-model="dialog.acknowledged" type="checkbox" class="mt-0.5 h-4.5 w-4.5 shrink-0 accent-brand" />
                                        {{ copy.acknowledgement }}
                                    </label>

                                    <AdminField id="role-current-password" label="Your current password" required
                                        hint="Confirms it is you making this change." :error="roleSave.errors.currentPassword" v-slot="f">
                                        <input :id="f.id" v-bind="f.attrs" v-model="dialog.password" type="password"
                                            autocomplete="current-password" :maxlength="1024" :class="f.controlClass" />
                                    </AdminField>

                                    <AdminFormStatus :alert="roleSave.alert.value" />

                                    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                        <button type="button" :class="buttonClass" @click="closeDialog">Cancel</button>
                                        <PrimaryButton tag="button" type="submit" :variant="copy.promoting ? 'primary' : 'danger'"
                                            :disabled="!canSubmitRole" :loading="roleSave.saving.value">
                                            {{ roleSave.saving.value ? "Saving…" : copy.submitLabel }}
                                        </PrimaryButton>
                                    </div>
                                </form>
                            </DialogPanel>
                        </TransitionChild>
                    </div>
                </div>
            </Dialog>
        </TransitionRoot>

    </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from "@headlessui/vue";
import { UsersIcon } from "@heroicons/vue/24/outline";

import AdminBadge from "@/components/admin/ui/adminBadge.vue";
import AdminField from "@/components/admin/form/adminField.vue";
import AdminFormStatus from "@/components/admin/form/adminFormStatus.vue";
import AdminPageHeader from "@/components/admin/ui/adminPageHeader.vue";
import AdminStatePanel from "@/components/admin/ui/adminStatePanel.vue";
import Pagination from "@/components/products/pagination.vue";
import PrimaryButton from "@/components/ui/primaryButton.vue";

import { adminUserService } from "@/services/adminUserService";
import { parseApiError } from "@/services/apiClient";
import { useAdminSave } from "@/composables/useAdminSave";
import { formatDate } from "@/composables/useOrderSuccess";
import { restoreFocusAfterDialog } from "@/router/pageFocus";
import { useAuthStore } from "@/stores/authStore";
import {
    MAX_SEARCH_LENGTH, STATUS_LABELS, USER_ROLES, USER_STATUSES, accountStatus, apiParamsFrom, blockConfirmation,
    emptyListMessage, fullName, listQueryFrom, roleChangeCopy, roleLabel, searchError, unblockConfirmation, userActions,
} from "@/utils/adminUserRules";

const PAGE_SIZE = 20;

// Shared by the column headings and each row (desktop); rows restack below lg.
const GRID = "gap-x-4 px-4 sm:px-5 lg:grid-cols-[minmax(0,2fr)_6rem_6rem_7.5rem_4rem_minmax(0,1.9fr)]";

// Same button and select styles as the coupons and orders pages.
const baseClass = "inline-flex min-h-9 items-center justify-center rounded-control px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer";
const buttonClass = `${baseClass} border border-slate-300 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50 outline-brand`;
const dangerClass = `${baseClass} border border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50 outline-red-600`;
const selectClass = "mt-1.5 block min-h-11 w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 transition-colors duration-150 hover:border-slate-400 focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20 sm:text-sm";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

// ------------------------------------------------------------ list (the URL is the source of truth)

const query = computed(() => listQueryFrom(route.query));
const filtered = computed(() => Boolean(query.value.search || query.value.role || query.value.status));

const users = ref([]);
const pagination = ref(null);
const loading = ref(true);
const error = ref("");
const forbidden = ref(false);
const announcement = ref("");

const searchInput = ref("");
const searchMessage = ref("");

let focusRangeAfterLoad = false;

// Only the newest request may update the list.
let latestRequest = 0;

async function load() {
    const request = ++latestRequest;
    const current = query.value;

    loading.value = true;
    error.value = "";
    forbidden.value = false;

    try {
        const result = await adminUserService.listUsers(apiParamsFrom(current, PAGE_SIZE));

        if (request !== latestRequest) return;

        // Past the last page: show the last page instead of an empty one.
        const { totalPages } = result.pagination;

        if (!result.users.length && current.page > 1 && totalPages > 0) {
            goToPage(totalPages, { replace: true });
            return;
        }

        users.value = result.users;
        pagination.value = result.pagination;

        if (focusRangeAfterLoad) {
            focusRangeAfterLoad = false;
            await nextTick();
            document.getElementById("admin-users-range")?.focus();
        }
    } catch (err) {
        if (request !== latestRequest) return;

        const { status: code, message } = parseApiError(err);
        forbidden.value = code === 403;
        error.value = message;
    } finally {
        if (request === latestRequest) loading.value = false;
    }
}

function pushQuery(changes) {
    const next = { ...route.query, ...changes };
    delete next.page; // a new search or filter starts at page 1

    for (const [key, value] of Object.entries(next)) if (!value) delete next[key];

    router.push({ query: next });
}

function goToPage(next, { replace = false } = {}) {
    if (!replace) focusRangeAfterLoad = true;

    const nextQuery = { ...route.query };
    if (next > 1) nextQuery.page = String(next);
    else delete nextQuery.page;

    return replace ? router.replace({ query: nextQuery }) : router.push({ query: nextQuery });
}

function applySearch() {
    searchMessage.value = searchError(searchInput.value);

    if (!searchMessage.value) pushQuery({ search: searchInput.value.trim() });
}

const setFilter = (key, value) => pushQuery({ [key]: value });

function clearFilters() {
    searchInput.value = "";
    searchMessage.value = "";
    pushQuery({ search: "", role: "", status: "" });
}

const rangeText = computed(() => {
    if (!pagination.value || !users.value.length) return "";

    const { page: current, limit, total, totalPages } = pagination.value;
    const first = (current - 1) * limit + 1;
    const last = first + users.value.length - 1;
    const range = `Showing ${first}–${last} of ${total} ${total === 1 ? "account" : "accounts"}`;

    return totalPages > 1 ? `${range} · Page ${current} of ${totalPages}` : range;
});

const liveMessage = computed(() => {
    if (announcement.value) return announcement.value;
    if (loading.value) return "Loading accounts";
    if (error.value) return `Accounts unavailable. ${error.value}`;
    if (!users.value.length) return "No accounts";
    return rangeText.value;
});

// ------------------------------------------------------------ row actions

const rowSave = useAdminSave();
const rowFor = ref(null);
const busy = computed(() => rowSave.saving.value || dialog.open);

// The signed-in admin's own row offers nothing (the server refuses it anyway).
const actionsFor = (user) => userActions(user, auth.user?.id);

function hintFor(user) {
    const actions = actionsFor(user);
    if (actions.reason) return actions.reason;
    if (user.role === "CUSTOMER" && user.blockedAt) return "Unblock this account before making it an admin.";
    return "";
}

// Replaces the listed copy with the server's answer.
function upsert(updated) {
    users.value = users.value.map((user) => (user.id === updated.id ? updated : user));
}

async function toggleBlock(user) {
    const unblocking = Boolean(user.blockedAt);
    if (!window.confirm(unblocking ? unblockConfirmation(user) : blockConfirmation(user))) return;

    rowFor.value = user.id;
    announcement.value = "";
    const saved = await rowSave.run(
        () => (unblocking ? adminUserService.unblockUser(user.id) : adminUserService.blockUser(user.id)),
        { successMessage: `${fullName(user)} ${unblocking ? "can sign in again" : "is blocked and signed out everywhere"}.` },
    );

    if (saved) {
        upsert(saved);
        announcement.value = rowSave.success.value;
    } else if (["conflict", "error"].includes(rowSave.alert.value?.kind)) {
        // Changed elsewhere (409) or gone (404): show the current state; the message stays on its row.
        load();
    }
}

// ------------------------------------------------------------ role change dialog

const roleSave = useAdminSave();
const dialog = reactive({ open: false, user: null, role: "", password: "", acknowledged: false, triggerId: "" });
const copy = computed(() => (dialog.user ? roleChangeCopy(dialog.user, dialog.role) : {}));
const canSubmitRole = computed(() => Boolean(dialog.password) && (!copy.value.promoting || dialog.acknowledged) && !roleSave.saving.value);

function openRoleDialog(user) {
    roleSave.clear();
    rowSave.clear();
    Object.assign(dialog, {
        open: true,
        user,
        role: user.role === "ADMIN" ? "CUSTOMER" : "ADMIN",
        password: "",
        acknowledged: false,
        triggerId: `user-${user.id}-role`,
    });
}

function closeDialog() {
    if (roleSave.saving.value) return;

    dialog.open = false;
    dialog.password = "";
}

// The dialog keeps its content until it has faded out, then forgets it.
function afterDialogLeave() {
    const { triggerId } = dialog;
    Object.assign(dialog, { user: null, role: "", password: "", acknowledged: false });
    restoreFocusAfterDialog(triggerId, false);
}

async function submitRoleChange() {
    if (!canSubmitRole.value) return;

    const { user, role } = dialog;
    const currentPassword = dialog.password;
    const success = copy.value.success;

    const saved = await roleSave.run(
        () => adminUserService.changeRole(user.id, { role, currentPassword }),
        { successMessage: success, isField: (key) => key === "currentPassword" },
    );

    // Never keep a password after an attempt, right or wrong.
    dialog.password = "";

    if (!saved) {
        if (roleSave.alert.value?.kind === "conflict") load();
        return;
    }

    upsert(saved);
    rowFor.value = user.id;
    rowSave.clear();
    rowSave.success.value = success;
    announcement.value = success;
    dialog.open = false;
}

// ------------------------------------------------------------ loading

watch(() => route.query, () => {
    if (route.name !== "admin-users") return;

    searchInput.value = query.value.search;
    searchMessage.value = "";
    announcement.value = "";
    load();
}, { immediate: true });
</script>
