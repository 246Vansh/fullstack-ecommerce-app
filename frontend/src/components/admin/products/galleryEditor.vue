<template>
    <!-- Edits `images` (a reactive array owned by the page) in place. Order is
         display order; the first image is the product's main image. -->
    <div>
        <p class="sr-only" aria-live="polite">{{ announcement }}</p>

        <p v-if="!images.length" class="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
            No images. The store shows a placeholder until one is added.
        </p>

        <ol v-else ref="listEl" class="space-y-3">
            <li v-for="(image, index) in images" :key="image.key"
                class="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-start">

                <div class="flex items-center gap-3 sm:block">
                    <span class="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 px-1.5 text-xs font-semibold text-slate-600 sm:mb-2">
                        {{ index + 1 }}
                    </span>
                    <img v-if="previewable(image.url)" :src="sizedImage(image.url.trim(), 160)" alt=""
                        class="h-16 w-16 rounded-md bg-slate-100 object-cover" loading="lazy" />
                    <span v-else class="flex h-16 w-16 items-center justify-center rounded-md bg-slate-100 text-slate-400">
                        <PhotoIcon class="h-6 w-6" aria-hidden="true" />
                    </span>
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

                <div class="flex gap-1 sm:flex-col">
                    <button type="button" :disabled="disabled || index === 0" :data-move="`up-${image.key}`"
                        :aria-label="`Move image ${index + 1} up`" :class="iconButton" @click="move(index, -1, 'up', image.key)">
                        <ArrowUpIcon class="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button type="button" :disabled="disabled || index === images.length - 1" :data-move="`down-${image.key}`"
                        :aria-label="`Move image ${index + 1} down`" :class="iconButton" @click="move(index, 1, 'down', image.key)">
                        <ArrowDownIcon class="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button type="button" :disabled="disabled" :aria-label="`Remove image ${index + 1}`"
                        :class="[iconButton, 'hover:text-red-700']" @click="remove(index)">
                        <TrashIcon class="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>
            </li>
        </ol>

        <button type="button" :disabled="disabled || images.length >= LIMITS.images"
            class="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-50 cursor-pointer"
            @click="add">
            <PlusIcon class="h-4 w-4" aria-hidden="true" />
            Add image
        </button>
        <span v-if="images.length >= LIMITS.images" class="ml-2 text-xs text-slate-500">Up to {{ LIMITS.images }} images.</span>
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

const iconButton = "rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed";

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
