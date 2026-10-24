<template>
    <!-- Tablet / desktop: a real table. Fields are exactly GET /api/admin/products' list rows.
         Category folds under the name below xl and Updated shows from 2xl, so the
         table fits beside the sidebar; overflow-x-auto remains for long content.
         `relative` keeps the sr-only header (position: absolute) inside the scroll
         box; without it, it escapes and widens the whole page. -->
    <div class="relative hidden overflow-x-auto rounded-card border border-slate-200 bg-white shadow-card md:block">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
            <caption class="sr-only">{{ caption }}</caption>
            <thead class="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                    <th scope="col" class="py-3 pl-4 pr-3">Product</th>
                    <th scope="col" class="hidden px-3 py-3 xl:table-cell">Category</th>
                    <th scope="col" class="px-3 py-3 text-right">Price</th>
                    <th scope="col" class="px-3 py-3 text-right">Stock</th>
                    <th scope="col" class="px-3 py-3">Status</th>
                    <th scope="col" class="hidden px-3 py-3 2xl:table-cell">Updated</th>
                    <th scope="col" class="py-3 pl-3 pr-4 text-right"><span class="sr-only">Actions</span></th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
                <tr v-for="product in products" :key="product.id" class="align-middle transition-colors hover:bg-slate-50/70">
                    <td class="py-3 pl-4 pr-3">
                        <div class="flex min-w-0 items-center gap-3">
                            <Thumbnail :product="product" />
                            <div class="min-w-0">
                                <p class="max-w-44 truncate font-semibold text-slate-900 xl:max-w-56 2xl:max-w-xs" :title="product.name">{{ product.name }}</p>
                                <p class="max-w-44 truncate text-slate-500 xl:max-w-56 2xl:max-w-xs">
                                    {{ product.brand || "No brand" }} · <span class="font-mono text-xs">{{ product.slug }}</span>
                                </p>
                                <p class="max-w-44 truncate text-slate-500 xl:hidden">
                                    {{ product.category.name }}<span v-if="!product.category.isActive" class="text-amber-800"> (category inactive)</span>
                                </p>
                            </div>
                        </div>
                    </td>
                    <td class="hidden px-3 py-3 text-slate-700 xl:table-cell">
                        {{ product.category.name }}
                        <span v-if="!product.category.isActive" class="block text-xs font-medium text-amber-800">Category inactive</span>
                    </td>
                    <td class="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                        <span class="font-semibold text-slate-900">{{ formatPrice(product.price, product.currency) }}</span>
                        <span v-if="product.originalPrice != null" class="block text-xs text-slate-500 line-through">
                            <span class="sr-only">Was </span>{{ formatPrice(product.originalPrice, product.currency) }}
                        </span>
                    </td>
                    <td class="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                        <StockCell :product="product" class="items-end" />
                    </td>
                    <td class="px-3 py-3">
                        <StatusBadges :product="product" />
                    </td>
                    <td class="hidden px-3 py-3 whitespace-nowrap text-slate-500 2xl:table-cell">
                        {{ formatDate(product.updatedAt) }}
                    </td>
                    <td class="py-3 pl-3 pr-4">
                        <!-- Stacked below xl to keep the table within the content width -->
                        <RowActions :product="product" class="flex-col items-stretch xl:flex-row xl:flex-nowrap xl:items-center xl:justify-end" />
                    </td>
                </tr>
            </tbody>
        </table>
    </div>

    <!-- Phones: one card per product -->
    <ul class="space-y-3 md:hidden" :aria-label="caption">
        <li v-for="product in products" :key="product.id" class="rounded-card border border-slate-200 bg-white p-4 shadow-card">
            <div class="flex min-w-0 gap-3">
                <Thumbnail :product="product" />
                <div class="min-w-0 flex-1">
                    <p class="wrap-anywhere font-semibold text-slate-900">{{ product.name }}</p>
                    <p class="wrap-anywhere text-sm text-slate-500">
                        {{ product.brand || "No brand" }} · {{ product.category.name }}
                        <span v-if="!product.category.isActive" class="text-amber-800">(category inactive)</span>
                    </p>
                    <StatusBadges :product="product" class="mt-2" />
                </div>
            </div>

            <dl class="mt-3 grid grid-cols-2 gap-3 rounded-control bg-slate-50 px-3 py-2.5 text-sm">
                <div>
                    <dt class="text-xs text-slate-500">Price</dt>
                    <dd class="font-semibold tabular-nums text-slate-900">
                        {{ formatPrice(product.price, product.currency) }}
                        <span v-if="product.originalPrice != null" class="ml-1 text-xs font-normal text-slate-500 line-through">
                            <span class="sr-only">Was </span>{{ formatPrice(product.originalPrice, product.currency) }}
                        </span>
                    </dd>
                </div>
                <div>
                    <dt class="text-xs text-slate-500">Stock</dt>
                    <dd><StockCell :product="product" class="items-start" /></dd>
                </div>
            </dl>

            <RowActions :product="product" class="mt-3" :full="true" />
        </li>
    </ul>
</template>

<script setup>
import { h } from "vue";
import { PhotoIcon } from "@heroicons/vue/24/outline";

import AdminBadge from "@/components/admin/ui/adminBadge.vue";
import PrimaryButton from "@/components/ui/primaryButton.vue";
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
        src: sizedImage(product.image, 112),
        alt: "",
        loading: "lazy",
        width: 56,
        height: 56,
        class: "h-14 w-14 shrink-0 rounded-control bg-slate-100 object-cover ring-1 ring-slate-900/5",
    })
    : h("div", { class: "flex h-14 w-14 shrink-0 items-center justify-center rounded-control bg-slate-100 text-slate-400" },
        [h(PhotoIcon, { class: "h-6 w-6", "aria-hidden": "true" })]));
Thumbnail.props = ["product"];

// Zero stock is spelled out, not only coloured.
const StockCell = ({ product }) => h("div", { class: "flex flex-col gap-0.5" }, [
    product.totalStock === 0
        ? h(AdminBadge, { tone: "danger" }, () => "Out of stock")
        : h("span", { class: "font-semibold text-slate-900" }, product.totalStock.toLocaleString("en-US")),
    h("span", { class: "text-xs text-slate-500" }, variantSummary(product)),
]);
StockCell.props = ["product"];

const StatusBadges = ({ product }) => h("div", { class: "flex flex-wrap gap-1.5" }, [
    product.isActive
        ? h(AdminBadge, { tone: "success" }, () => "Active")
        : h(AdminBadge, { tone: "neutral" }, () => "Inactive"),
    product.isNew && h(AdminBadge, { tone: "brand" }, () => "New"),
].filter(Boolean));
StatusBadges.props = ["product"];

// Edit opens the product form. "View" only for products the storefront shows.
// `full`: phone cards stretch the buttons across the card.
const RowActions = ({ product, full }) => h("div", { class: "flex flex-wrap gap-2" }, [
    h(PrimaryButton, {
        to: { name: "admin-product-edit", params: { id: product.id } },
        variant: "outline",
        size: "sm",
        class: full ? "flex-1" : "",
        "aria-label": `Edit ${product.name}`,
    }, () => "Edit"),
    product.isActive && h(PrimaryButton, {
        to: { name: "product-details", params: { id: product.id } },
        variant: "ghost",
        size: "sm",
        class: full ? "flex-1" : "",
        "aria-label": `View ${product.name} in the store`,
    }, () => "View"),
].filter(Boolean));
RowActions.props = ["product", "full"];
</script>
