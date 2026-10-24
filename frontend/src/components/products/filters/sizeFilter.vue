<template>
    <fieldset>

        <legend class="sr-only">
            Sizes
        </legend>

        <div class="flex flex-wrap gap-2">
            <button v-for="size in options" :key="size.id" type="button" :aria-pressed="modelValue.includes(size.id)"
                @click="toggleSize(size.id)" :class="[
                'flex h-11 min-w-12 items-center justify-center rounded-control border px-4 text-sm font-medium transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',

                modelValue.includes(size.id)
                    ? 'border-brand bg-brand text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
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