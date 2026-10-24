<template>
    <!-- Edits `images` (a reactive array owned by the page) in place. Order is
         display order; the first image is the product's main image. -->
    <div>
        <p class="sr-only" aria-live="polite">{{ announcement }}</p>

        <div v-if="!images.length" class="flex flex-col items-center rounded-control border border-dashed border-slate-300 bg-slate-50/60 px-4 py-8 text-center">
            <PhotoIcon class="h-8 w-8 text-slate-400" aria-hidden="true" />
            <p class="mt-2 text-sm text-slate-600">No images. The store shows a placeholder until one is added.</p>
        </div>

        <ol v-else ref="listEl" class="space-y-3">
            <li v-for="(image, index) in images" :key="image.key"
                class="flex flex-col gap-4 rounded-control border border-slate-200 bg-white p-3 sm:flex-row sm:items-start sm:p-4">

                <div class="flex items-center gap-3 sm:block">
                    <div class="relative">
                        <img v-if="previewable(image.url)" :src="sizedImage(image.url.trim(), 192)" alt=""
                            class="h-20 w-20 rounded-control bg-slate-100 object-cover ring-1 ring-slate-900/5" loading="lazy" />
                        <span v-else class="flex h-20 w-20 items-center justify-center rounded-control bg-slate-100 text-slate-400">
                            <PhotoIcon class="h-7 w-7" aria-hidden="true" />
                        </span>
                        <span class="absolute -left-2 -top-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-xs font-semibold text-slate-700 shadow-card ring-1 ring-slate-200">
                            {{ index + 1 }}
                        </span>
                    </div>
                    <span v-if="index === 0" class="text-xs font-semibold text-brand sm:mt-2 sm:block sm:text-center">Main image</span>
                </div>

                <div class="grid min-w-0 flex-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                    <AdminField :id="`${prefix}-${image.key}-url`" :label="`Image ${index + 1} URL`" required
                        :error="errors[`images[${index}].url`]" v-slot="f">
                        <input :id="f.id" v-bind="f.attrs" v-model="image.url" type="url" inputmode="url"
                            :maxlength="LIMITS.url" autocomplete="off" spellcheck="false" placeholder="https://"
                            :class="f.controlClass" />
                    </AdminField>
                    <AdminField :id="`${prefix}-${image.key}-alt`" :label="`Image ${index + 1} alt text`" optional
                        :error="errors[`images[${index}].altText`]" v-slot="f">
                        <input :id="f.id" v-bind="f.attrs" v-model="image.altText" type="text"
                            :maxlength="LIMITS.altText" autocomplete="off" :class="f.controlClass" />
                    </AdminField>
                </div>

                <div class="flex gap-2 sm:flex-col">
                    <button type="button" :disabled="disabled || index === 0" :data-move="`up-${image.key}`"
                        :aria-label="`Move image ${index + 1} up`" :class="iconButton" @click="move(index, -1, 'up', image.key)">
                        <ArrowUpIcon class="h-5 w-5" aria-hidden="true" />
                    </button>
                    <button type="button" :disabled="disabled || index === images.length - 1" :data-move="`down-${image.key}`"
                        :aria-label="`Move image ${index + 1} down`" :class="iconButton" @click="move(index, 1, 'down', image.key)">
                        <ArrowDownIcon class="h-5 w-5" aria-hidden="true" />
                    </button>
                    <button type="button" :disabled="disabled" :aria-label="`Remove image ${index + 1}`"
                        :class="removeButton" @click="remove(index)">
                        <TrashIcon class="h-5 w-5" aria-hidden="true" />
                    </button>
                </div>
            </li>
        </ol>

        <button type="button" :disabled="disabled || images.length >= LIMITS.images"
            class="mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-control border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 transition-colors hover:border-slate-400 hover:bg-slate-50 outline-brand focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            @click="add">
            <PlusIcon class="h-4 w-4" aria-hidden="true" />
            Add image
        </button>
        <span v-if="images.length >= LIMITS.images" class="ml-2 text-xs text-slate-600">Up to {{ LIMITS.images }} images.</span>
    </div>
</template>

<script setup>
import { nextTick, ref } from "vue";
import { ArrowDownIcon, ArrowUpIcon, PhotoIcon, PlusIcon, TrashIcon } from "@heroicons/vue/20/solid";

import AdminField from "@/components/admin/form/adminField.vue";
import { LIMITS, httpsUrlError, newImageForm } from "@/utils/adminCatalogRules";
import { sizedImage } from "@/utils/images";

const props = defineProps({
    // [{ key, url, altText }]; `key` is a stable local id for rendering.
    images: { type: Array, required: true },
    errors: { type: Object, default: () => ({}) },
    prefix: { type: String, default: "gallery" },
    disabled: { type: Boolean, default: false },
});

const emit = defineEmits(["change"]);

const listEl = ref(null);
const announcement = ref("");

const iconBase = "flex h-11 w-11 items-center justify-center rounded-control border bg-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed";
const iconButton = `${iconBase} border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 outline-brand`;
const removeButton = `${iconBase} border-slate-200 text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700 outline-red-600`;

const previewable = (url) => !httpsUrlError(url, { required: true });

// Moves an image and keeps focus on the same button (now one row up/down),
// or on the other arrow when the image reaches the end of the list.
async function move(index, step, direction, key) {
    const target = index + step;
    const [image] = props.images.splice(index, 1);
    props.images.splice(target, 0, image);
    announcement.value = `Image moved to position ${target + 1} of ${props.images.length}`;
    emit("change");

    await nextTick();
    const same = listEl.value?.querySelector(`[data-move="${direction}-${key}"]`);
    const other = listEl.value?.querySelector(`[data-move="${direction === "up" ? "down" : "up"}-${key}"]`);
    (same && !same.disabled ? same : other)?.focus();
}

function remove(index) {
    props.images.splice(index, 1);
    announcement.value = `Image ${index + 1} removed. ${props.images.length} left.`;
    emit("change");
}

async function add() {
    const image = newImageForm();
    props.images.push(image);
    emit("change");

    await nextTick();
    document.getElementById(`${props.prefix}-${image.key}-url`)?.focus();
}
</script>
