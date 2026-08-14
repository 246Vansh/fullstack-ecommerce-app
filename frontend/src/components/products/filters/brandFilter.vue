<template>
    <fieldset>

        <legend class="sr-only">Brands</legend>

        <div class="space-y-4">
            <div v-for="brand in options" :key="brand.id" class="flex items-center">
                <input :id="`brand-${brand.id}`" type="checkbox" :checked="modelValue.includes(brand.id)"
                    class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    @change="toggleBrand(brand.id)" />

                <label :for="`brand-${brand.id}`" class="ml-3 text-sm text-gray-600">
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