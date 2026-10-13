<template>
    <!-- Desktop / tablet: a real table. Fields are exactly GET /api/admin/products' list rows. -->
    <div class="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
            <caption class="sr-only">{{ caption }}</caption>
            <thead class="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                    <th scope="col" class="px-4 py-3">Product</th>
                    <th scope="col" class="px-4 py-3">Category</th>
                    <th scope="col" class="px-4 py-3 text-right">Price</th>
                    <th scope="col" class="px-4 py-3 text-right">Stock</th>
                    <th scope="col" class="px-4 py-3">Status</th>
                    <th scope="col" class="hidden px-4 py-3 lg:table-cell">Updated</th>
                    <th scope="col" class="px-4 py-3 text-right"><span class="sr-only">Actions</span></th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
                <tr v-for="product in products" :key="product.id" class="align-middle">
                    <td class="px-4 py-3">
                        <div class="flex min-w-0 items-center gap-3">
                            <Thumbnail :product="product" />
                            <div class="min-w-0">
                                <p class="max-w-xs truncate font-semibold text-slate-900">{{ product.name }}</p>
                                <p class="max-w-xs truncate text-slate-500">
                                    {{ product.brand || "No brand" }} · <span class="font-mono text-xs">{{ product.slug }}</span>
                                </p>
                            </div>
                        </div>
                    </td>
                    <td class="px-4 py-3 text-slate-700">
                        {{ product.category.name }}
                        <span v-if="!product.category.isActive" class="block text-xs text-amber-700">Category inactive</span>
                    </td>
                    <td class="px-4 py-3 text-right whitespace-nowrap">
                        <span class="font-semibold text-slate-900">{{ formatPrice(product.price) }}</span>
                        <span v-if="product.originalPrice != null" class="block text-xs text-slate-500 line-through">
                            <span class="sr-only">Was </span>{{ formatPrice(product.originalPrice) }}
                        </span>
                    </td>
                    <td class="px-4 py-3 text-right whitespace-nowrap">
                        <span class="font-semibold" :class="product.totalStock === 0 ? 'text-red-700' : 'text-slate-900'">
                            {{ product.totalStock }}
                        </span>
                        <span class="block text-xs text-slate-500">{{ variantSummary(product) }}</span>
                    </td>
                    <td class="px-4 py-3">
                        <StatusBadges :product="product" />
                    </td>
                    <td class="hidden px-4 py-3 whitespace-nowrap text-slate-500 lg:table-cell">
                        {{ formatDate(product.updatedAt) }}
                    </td>
                    <td class="px-4 py-3">
                        <RowActions :product="product" class="justify-end" />
                    </td>
                </tr>
            </tbody>
        </table>
    </div>

    <!-- Mobile: one card per product -->
    <ul class="space-y-3 md:hidden" :aria-label="caption">
        <li v-for="product in products" :key="product.id" class="rounded-xl border border-slate-200 bg-white p-4">
            <div class="flex min-w-0 gap-3">
                <Thumbnail :product="product" />
                <div class="min-w-0 flex-1">
                    <p class="wrap-anywhere font-semibold text-slate-900">{{ product.name }}</p>
                    <p class="wrap-anywhere text-sm text-slate-500">
                        {{ product.brand || "No brand" }} · {{ product.category.name }}
                        <span v-if="!product.category.isActive" class="text-amber-700">(category inactive)</span>
                    </p>
                    <StatusBadges :product="product" class="mt-2" />
                </div>
            </div>

            <dl class="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                    <dt class="text-slate-500">Price</dt>
                    <dd class="font-semibold text-slate-900">
                        {{ formatPrice(product.price) }}
                        <span v-if="product.originalPrice != null" class="ml-1 text-xs font-normal text-slate-500 line-through">
                            <span class="sr-only">Was </span>{{ formatPrice(product.originalPrice) }}
                        </span>
                    </dd>
                </div>
                <div>
                    <dt class="text-slate-500">Stock</dt>
                    <dd class="font-semibold" :class="product.totalStock === 0 ? 'text-red-700' : 'text-slate-900'">
                        {{ product.totalStock }}
                        <span class="text-xs font-normal text-slate-500">· {{ variantSummary(product) }}</span>
                    </dd>
                </div>
            </dl>

            <RowActions :product="product" class="mt-3 border-t border-slate-100 pt-3" />
        </li>
    </ul>
</template>

<script setup>
import { h } from "vue";
import { RouterLink } from "vue-router";
import { PhotoIcon } from "@heroicons/vue/24/outline";

import { formatPrice } from "@/utils/money";
import { formatDate } from "@/composables/useOrderSuccess";
import { sizedImage } from "@/utils/images";

defineProps({
    products: { type: Array, required: true },
    caption: { type: String, default: "Products" },
});

// totalStock counts active variants only (server rule).
const variantSummary = (product) => product.variantCount === product.activeVariantCount
    ? `${product.variantCount} ${product.variantCount === 1 ? "variant" : "variants"}`
    : `${product.activeVariantCount} of ${product.variantCount} variants active`;

// Decorative: the product name is always next to it.
const Thumbnail = ({ product }) => (product.image
    ? h("img", {
        src: sizedImage(product.image, 96),
        alt: "",
        loading: "lazy",
        width: 48,
        height: 48,
        class: "h-12 w-12 shrink-0 rounded-lg bg-slate-100 object-cover",
    })
    : h("div", { class: "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400" },
        [h(PhotoIcon, { class: "h-6 w-6", "aria-hidden": "true" })]));
Thumbnail.props = ["product"];

const badge = (text, classes) => h("span", { class: `rounded-full px-2.5 py-0.5 text-xs font-semibold ${classes}` }, text);

const StatusBadges = ({ product }) => h("div", { class: "flex flex-wrap gap-1.5" }, [
    product.isActive
        ? badge("Active", "bg-green-100 text-green-800")
        : badge("Inactive", "bg-slate-200 text-slate-700"),
    product.isNew && badge("New", "bg-indigo-100 text-indigo-800"),
].filter(Boolean));
StatusBadges.props = ["product"];

const linkClass = "rounded-lg px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-indigo-600";

// Edit opens the Phase 12.2B form route. "View" only for products the storefront shows.
const RowActions = ({ product }) => h("div", { class: "flex flex-wrap items-center gap-2" }, [
    h(RouterLink, {
        to: { name: "admin-product-edit", params: { id: product.id } },
        class: `${linkClass} border border-slate-200 text-slate-700 hover:bg-slate-50`,
        "aria-label": `Edit ${product.name}`,
    }, () => "Edit"),
    product.isActive && h(RouterLink, {
        to: { name: "product-details", params: { id: product.id } },
        class: `${linkClass} text-indigo-700 hover:bg-indigo-50`,
        "aria-label": `View ${product.name} in the store`,
    }, () => "View"),
].filter(Boolean));
RowActions.props = ["product"];
</script>
