<template>
    <div class="mx-auto max-w-5xl">

        <AdminPageHeader title="Coupons"
            description="Public codes any customer can apply at checkout. A coupon used by an order can be deactivated but not deleted.">
            <template v-if="state === 'ready' && !creating" #actions>
                <PrimaryButton id="new-coupon-button" tag="button" class="w-full sm:w-auto" @click="openCreate">
                    <PlusIcon class="-ml-1 h-5 w-5" aria-hidden="true" />
                    New coupon
                </PrimaryButton>
            </template>
        </AdminPageHeader>

        <p class="sr-only" aria-live="polite">{{ announcement }}</p>

        <!-- Filters -->
        <form class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end" role="search" aria-label="Filter coupons" @submit.prevent="applyFilters">
            <div class="min-w-0 flex-1">
                <label for="coupon-search" class="block text-sm font-medium text-slate-900">Search by code</label>
                <input id="coupon-search" v-model="filters.search" type="search" maxlength="40" autocomplete="off" spellcheck="false"
                    class="mt-1.5 block min-h-11 w-full rounded-control border border-slate-300 bg-white px-3 py-2 font-mono text-base uppercase text-slate-900 placeholder:font-sans placeholder:normal-case placeholder:text-slate-400 hover:border-slate-400 focus:border-brand focus:ring-3 focus:ring-brand/20 focus:outline-none sm:text-sm"
                    placeholder="e.g. WELCOME" />
            </div>
            <div class="sm:w-44">
                <label for="coupon-active" class="block text-sm font-medium text-slate-900">Show</label>
                <select id="coupon-active" v-model="filters.isActive" @change="applyFilters"
                    class="mt-1.5 block min-h-11 w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 hover:border-slate-400 focus:border-brand focus:ring-3 focus:ring-brand/20 focus:outline-none sm:text-sm">
                    <option value="">All coupons</option>
                    <option value="true">Active only</option>
                    <option value="false">Inactive only</option>
                </select>
            </div>
            <PrimaryButton tag="button" type="submit" variant="outline" class="sm:w-auto">Search</PrimaryButton>
        </form>

        <AdminStatePanel v-if="state === 'loading'" kind="loading" class="mt-6" title="Loading coupons" />

        <AdminStatePanel v-else-if="state === 'forbidden'" kind="forbidden" class="mt-6" title="Admin access required"
            message="The server did not accept your account as an administrator. Sign out and sign in again if your access changed." />

        <AdminStatePanel v-else-if="state === 'error'" kind="error" class="mt-6" title="Coupons unavailable" :message="loadError">
            <PrimaryButton tag="button" variant="outline" @click="load()">Try again</PrimaryButton>
        </AdminStatePanel>

        <template v-else>
            <section v-if="creating" aria-labelledby="new-coupon-heading"
                class="mt-6 rounded-card border border-brand/25 bg-white p-4 shadow-card sm:p-6">
                <AdminSectionHeading heading-id="new-coupon-heading" title="New coupon"
                    text="Percentages apply to the merchandise subtotal; shipping is never discounted." />
                <CouponForm ref="createForm" class="mt-5" @saved="created" @cancel="closeCreate" @dirty="setDirty('new', $event)" />
            </section>

            <AdminStatePanel v-if="!coupons.length" kind="empty" class="mt-6" :icon="TicketIcon"
                :title="filtered ? 'No coupons match' : 'No coupons yet'"
                :message="filtered ? 'Try another code or show all coupons.' : 'Create a code such as WELCOME10 for customers to use at checkout.'">
                <PrimaryButton v-if="filtered" tag="button" variant="outline" @click="clearFilters">Show all coupons</PrimaryButton>
            </AdminStatePanel>

            <template v-else>
                <p class="mt-6 mb-3 text-sm text-slate-600">
                    {{ pagination.total }} {{ pagination.total === 1 ? "coupon" : "coupons" }}
                </p>

                <ul class="space-y-2" aria-label="Coupons">
                    <li v-for="coupon in coupons" :key="coupon.id">
                        <div class="rounded-control border shadow-card"
                            :class="coupon.isActive ? 'border-slate-200 bg-white' : 'border-dashed border-slate-300 bg-slate-50'">
                            <div class="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
                                <div class="flex min-w-0 flex-1 items-center gap-3">
                                    <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand" aria-hidden="true">
                                        <TicketIcon class="h-5 w-5" />
                                    </span>
                                    <div class="min-w-0">
                                        <p class="wrap-anywhere font-mono font-semibold text-slate-900">{{ coupon.code }}</p>
                                        <p class="wrap-anywhere text-sm text-slate-600">
                                            {{ couponTerms(coupon) }}
                                            <template v-if="coupon.minimumOrderAmount > 0">
                                                · min {{ formatPrice(coupon.minimumOrderAmount, coupon.currency) }}
                                            </template>
                                            · {{ usageText(coupon) }}<template v-if="coupon.usageLimitPerUser"> ({{ coupon.usageLimitPerUser }} per customer)</template>
                                        </p>
                                        <p class="text-xs text-slate-500">{{ validity(coupon) }}</p>
                                    </div>
                                </div>
                                <div class="flex flex-wrap items-center gap-2 sm:justify-end">
                                    <AdminBadge :tone="statusOf(coupon).tone" class="mr-auto sm:mr-1">{{ statusOf(coupon).label }}</AdminBadge>
                                    <button :id="`coupon-${coupon.id}-usage`" type="button" :aria-expanded="usageFor === coupon.id"
                                        :aria-controls="`coupon-${coupon.id}-usage-panel`" :class="buttonClass" @click="toggleUsage(coupon)">
                                        Usage<span class="sr-only"> of {{ coupon.code }}</span>
                                    </button>
                                    <button :id="`coupon-${coupon.id}-edit`" type="button" :aria-expanded="editingId === coupon.id"
                                        :aria-controls="`coupon-${coupon.id}-panel`" :class="buttonClass" @click="openEdit(coupon)">
                                        Edit<span class="sr-only"> {{ coupon.code }}</span>
                                    </button>
                                    <button type="button" :disabled="rowSave.saving.value"
                                        :class="coupon.isActive ? dangerClass : buttonClass" @click="toggleActive(coupon)">
                                        {{ coupon.isActive ? "Deactivate" : "Activate" }}<span class="sr-only"> {{ coupon.code }}</span>
                                    </button>
                                    <button v-if="coupon.deletable" type="button" :disabled="rowSave.saving.value" :class="dangerClass"
                                        @click="remove(coupon)">
                                        Delete<span class="sr-only"> {{ coupon.code }}</span>
                                    </button>
                                </div>
                            </div>

                            <div v-if="rowFor === coupon.id && (rowSave.alert.value || rowSave.success.value)" class="px-3 pb-3 sm:px-4 sm:pb-4">
                                <AdminFormStatus :alert="rowSave.alert.value" :success="rowSave.success.value" />
                            </div>

                            <!-- Usage: the most recent orders placed with it -->
                            <div v-if="usageFor === coupon.id" :id="`coupon-${coupon.id}-usage-panel`"
                                class="border-t border-slate-200 bg-slate-50/60 p-3 text-sm sm:p-4">
                                <p v-if="usage.loading" class="text-slate-600">Loading usage…</p>
                                <p v-else-if="usage.error" role="alert" class="font-medium text-red-700">{{ usage.error }}</p>
                                <template v-else-if="usage.coupon">
                                    <p class="text-slate-700">
                                        {{ usage.coupon.usedCount }} {{ usage.coupon.usedCount === 1 ? "use" : "uses" }} held by orders ·
                                        {{ usage.coupon.orderCount }} {{ usage.coupon.orderCount === 1 ? "order" : "orders" }} placed in total
                                        (cancelled and expired orders give their use back).
                                    </p>
                                    <p v-if="!usage.coupon.recentOrders.length" class="mt-2 text-slate-600">No orders have used this coupon yet.</p>
                                    <div v-else class="mt-3 overflow-x-auto">
                                        <table class="w-full min-w-lg text-left">
                                            <caption class="sr-only">Recent orders using {{ coupon.code }}</caption>
                                            <thead class="text-xs uppercase tracking-wide text-slate-500">
                                                <tr>
                                                    <th scope="col" class="py-2 pr-3">Order</th>
                                                    <th scope="col" class="py-2 pr-3">Customer</th>
                                                    <th scope="col" class="py-2 pr-3">Status</th>
                                                    <th scope="col" class="py-2 pr-3 text-right">Discount</th>
                                                    <th scope="col" class="py-2 text-right">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody class="divide-y divide-slate-200">
                                                <tr v-for="order in usage.coupon.recentOrders" :key="order.id">
                                                    <td class="py-2 pr-3">
                                                        <RouterLink :to="{ name: 'admin-order-detail', params: { id: order.id } }"
                                                            class="rounded-sm font-mono text-xs font-semibold text-brand underline underline-offset-4 hover:text-brand-hover outline-brand focus-visible:outline-2 focus-visible:outline-offset-2">
                                                            {{ order.orderNumber }}
                                                        </RouterLink>
                                                    </td>
                                                    <td class="wrap-anywhere py-2 pr-3 text-slate-700">{{ order.email }}</td>
                                                    <td class="py-2 pr-3 text-slate-700">{{ order.status.toLowerCase() }}</td>
                                                    <td class="py-2 pr-3 text-right tabular-nums text-slate-900">-{{ formatPrice(order.discount, order.currency) }}</td>
                                                    <td class="py-2 text-right tabular-nums text-slate-900">{{ formatPrice(order.total, order.currency) }}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </template>
                            </div>

                            <div v-if="editingId === coupon.id" :id="`coupon-${coupon.id}-panel`"
                                class="border-t border-slate-200 bg-slate-50/60 p-3 sm:p-4">
                                <CouponForm ref="editForm" :coupon="coupon" @saved="updated" @cancel="closeEdit"
                                    @dirty="setDirty(coupon.id, $event)" />
                            </div>
                        </div>
                    </li>
                </ul>

                <nav v-if="pagination.totalPages > 1" class="mt-4 flex items-center justify-between gap-3" aria-label="Coupon pages">
                    <PrimaryButton tag="button" variant="outline" size="sm" :disabled="pagination.page <= 1" @click="goTo(pagination.page - 1)">
                        Previous
                    </PrimaryButton>
                    <p class="text-sm text-slate-600">Page {{ pagination.page }} of {{ pagination.totalPages }}</p>
                    <PrimaryButton tag="button" variant="outline" size="sm" :disabled="pagination.page >= pagination.totalPages"
                        @click="goTo(pagination.page + 1)">
                        Next
                    </PrimaryButton>
                </nav>
            </template>
        </template>
    </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from "vue";
import { RouterLink } from "vue-router";
import { PlusIcon } from "@heroicons/vue/20/solid";
import { TicketIcon } from "@heroicons/vue/24/outline";

import AdminBadge from "@/components/admin/ui/adminBadge.vue";
import AdminFormStatus from "@/components/admin/form/adminFormStatus.vue";
import AdminPageHeader from "@/components/admin/ui/adminPageHeader.vue";
import AdminSectionHeading from "@/components/admin/ui/adminSectionHeading.vue";
import AdminStatePanel from "@/components/admin/ui/adminStatePanel.vue";
import CouponForm from "@/components/admin/coupons/couponForm.vue";
import PrimaryButton from "@/components/ui/primaryButton.vue";
import { adminCouponService } from "@/services/adminCouponService";
import { parseApiError } from "@/services/apiClient";
import { useAdminSave } from "@/composables/useAdminSave";
import { useUnsavedChanges } from "@/composables/useUnsavedChanges";
import { formatPrice } from "@/utils/money";
import { COUPON_STATUS, couponTerms, usageText } from "@/utils/couponRules";

// Same button styles as the categories page.
const baseClass = "inline-flex min-h-9 items-center justify-center rounded-control px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer";
const buttonClass = `${baseClass} border border-slate-300 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50 outline-brand`;
const dangerClass = `${baseClass} border border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50 outline-red-600`;

const PAGE_SIZE = 20;

const state = ref("loading");
const loadError = ref("");
const coupons = ref([]);
const pagination = ref({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
const announcement = ref("");

// ------------------------------------------------------------ list + filters

const filters = reactive({ search: "", isActive: "" });
// The filters of the list on screen (the inputs may have been edited since).
const applied = reactive({ search: "", isActive: "" });
const filtered = computed(() => Boolean(applied.search || applied.isActive));

// Only the latest request updates the list (quick filter or page changes).
let latest = 0;

async function load(page = pagination.value.page) {
    const request = ++latest;
    state.value = "loading";

    try {
        const result = await adminCouponService.listCoupons({
            page,
            limit: PAGE_SIZE,
            ...(applied.search && { search: applied.search }),
            ...(applied.isActive && { isActive: applied.isActive }),
        });
        if (request !== latest) return;
        coupons.value = result.coupons;
        pagination.value = result.pagination;
        state.value = "ready";
    } catch (err) {
        if (request !== latest) return;
        const { status, message } = parseApiError(err);
        state.value = status === 403 ? "forbidden" : "error";
        loadError.value = message;
    }
}

load(1);

function applyFilters() {
    applied.search = filters.search.trim();
    applied.isActive = filters.isActive;
    load(1);
}

function clearFilters() {
    filters.search = "";
    filters.isActive = "";
    applyFilters();
}

const goTo = (page) => load(page);

const statusOf = (coupon) => COUPON_STATUS[coupon.status] ?? COUPON_STATUS.INACTIVE;

const dateText = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function validity(coupon) {
    const from = `From ${dateText(coupon.startsAt)}`;
    return coupon.expiresAt ? `${from} until ${dateText(coupon.expiresAt)}` : `${from}, no expiry`;
}

// Responses carry the saved coupon; swap it in.
function upsert(coupon) {
    const index = coupons.value.findIndex((item) => item.id === coupon.id);
    if (index === -1) coupons.value.unshift(coupon);
    else coupons.value.splice(index, 1, coupon);
}

// ------------------------------------------------------------ unsaved changes

const dirtyForms = reactive(new Set());
const setDirty = (key, dirty) => (dirty ? dirtyForms.add(key) : dirtyForms.delete(key));
useUnsavedChanges(() => dirtyForms.size > 0);

// ------------------------------------------------------------ create

const creating = ref(false);
const createForm = ref(null);

async function openCreate() {
    creating.value = true;
    await nextTick();
    createForm.value?.focus();
}

async function closeCreate() {
    creating.value = false;
    setDirty("new", false);
    await nextTick();
    document.getElementById("new-coupon-button")?.focus();
}

async function created(coupon) {
    upsert(coupon);
    pagination.value = { ...pagination.value, total: pagination.value.total + 1 };
    announcement.value = `Coupon ${coupon.code} created.`;
    await closeCreate();
}

// ------------------------------------------------------------ edit

const editingId = ref(null);
const editForm = ref(null);

async function openEdit(coupon) {
    if (editingId.value === coupon.id) return closeEdit();
    if (editingId.value && dirtyForms.has(editingId.value) && !window.confirm("Discard the changes to the open coupon?")) return;

    if (editingId.value) setDirty(editingId.value, false);
    editingId.value = coupon.id;
    rowFor.value = null;

    await nextTick();
    [].concat(editForm.value)[0]?.focus();
}

async function closeEdit() {
    const id = editingId.value;
    editingId.value = null;
    setDirty(id, false);

    await nextTick();
    document.getElementById(`coupon-${id}-edit`)?.focus();
}

async function updated(coupon) {
    upsert(coupon);
    announcement.value = `Coupon ${coupon.code} saved.`;
    if (usageFor.value === coupon.id) usageFor.value = null;
    await closeEdit();
}

// ------------------------------------------------------------ usage

const usageFor = ref(null);
const usage = reactive({ loading: false, error: "", coupon: null });

async function toggleUsage(coupon) {
    if (usageFor.value === coupon.id) {
        usageFor.value = null;
        return;
    }

    usageFor.value = coupon.id;
    Object.assign(usage, { loading: true, error: "", coupon: null });

    try {
        const detail = await adminCouponService.getCoupon(coupon.id);
        if (usageFor.value !== coupon.id) return;
        usage.coupon = detail;
        // The list row may be stale (orders keep using it).
        const { recentOrders, ...row } = detail;
        upsert(row);
    } catch (err) {
        if (usageFor.value === coupon.id) usage.error = parseApiError(err).message;
    } finally {
        if (usageFor.value === coupon.id) usage.loading = false;
    }
}

// ------------------------------------------------------------ activate / deactivate / delete

const rowSave = useAdminSave();
const rowFor = ref(null);

async function toggleActive(coupon) {
    if (coupon.isActive && !window.confirm(`Deactivate ${coupon.code}? Customers can no longer apply it; orders already placed keep their discount.`)) return;

    rowFor.value = coupon.id;
    const saved = await rowSave.run(
        () => adminCouponService.setActive(coupon.id, !coupon.isActive),
        { successMessage: `${coupon.code} ${coupon.isActive ? "deactivated" : "activated"}.` },
    );

    if (saved) upsert(saved);
}

async function remove(coupon) {
    if (!window.confirm(`Delete ${coupon.code}? This cannot be undone.`)) return;

    rowFor.value = coupon.id;
    const result = await rowSave.run(() => adminCouponService.deleteCoupon(coupon.id), { successMessage: "" });

    if (result?.deleted) {
        coupons.value = coupons.value.filter((item) => item.id !== coupon.id);
        pagination.value = { ...pagination.value, total: Math.max(0, pagination.value.total - 1) };
        announcement.value = `Coupon ${coupon.code} deleted.`;
        rowFor.value = null;
        document.getElementById("new-coupon-button")?.focus();
    } else if (rowSave.alert.value?.kind === "conflict") {
        // Used since the list loaded: it can now only be deactivated.
        upsert({ ...coupon, deletable: false });
    }
}
</script>
