<template>
    <fieldset>

        <legend class="sr-only">
            Sizes
        </legend>

        <div class="flex flex-wrap gap-3">
            <button v-for="size in options" :key="size.id" type="button" @click="toggleSize(size.id)" :class="[
                'flex h-10 min-w-12 items-center justify-center rounded-lg border px-4 text-sm font-medium transition-all duration-200 cursor-pointer',

                modelValue.includes(size.id)
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            ]">
                {{ size.name }}
            </button>
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

function toggleSize(sizeId) {

    const updatedSizes = [...props.modelValue];
    const index = updatedSizes.indexOf(sizeId);

    if (index > -1) {
        updatedSizes.splice(index, 1);

    } else {
        updatedSizes.push(sizeId);

    }

    emit("update:modelValue", updatedSizes);

}

</script>