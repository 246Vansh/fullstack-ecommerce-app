<template>
    <fieldset>

        <legend class="sr-only">Brands</legend>

        <div class="-mx-2 max-h-72 space-y-1 overflow-y-auto px-2">
            <div v-for="brand in options" :key="brand.id">
                <label :for="`brand-${brand.id}`"
                    class="-mx-2 flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm text-slate-700 transition-colors duration-150 hover:bg-slate-50">
                    <input :id="`brand-${brand.id}`" type="checkbox" :checked="modelValue.includes(brand.id)"
                        class="h-4.5 w-4.5 shrink-0 cursor-pointer rounded accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        @change="toggleBrand(brand.id)" />
                    {{ brand.name }}
                </label>
            </div>
        </div>

    </fieldset>
</template>

<script setup>

const props = defineProps({

    options: {
        type: Array,
        default: () => [],
    },

    modelValue: {
        type: Array,
        default: () => [],
    },

});

const emit = defineEmits([
    "update:modelValue",
]);

function toggleBrand(brandId) {

    const updatedBrands = [...props.modelValue];
    const index = updatedBrands.indexOf(brandId);

    if (index > -1) {
        updatedBrands.splice(index, 1);

    } else {
        updatedBrands.push(brandId);

    }

    emit("update:modelValue", updatedBrands);

}
</script>