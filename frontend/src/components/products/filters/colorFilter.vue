<template>
    <fieldset>

        <legend class="sr-only">
            Colors
        </legend>

        <div class="flex flex-wrap gap-3">

            <button v-for="color in options" :key="color.id" type="button" :aria-label="color.name" :title="color.name"
                @click="selectColor(color.id)" :class="[
                    'relative flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200',

                    modelValue.includes(color.id)
                        ? 'ring-2 ring-indigo-600 ring-offset-2'
                        : 'ring-1 ring-gray-300 hover:ring-gray-400'
                ]">

                <span class="h-6 w-6 rounded-full border border-gray-200" :style="{ backgroundColor: color.hex }" />

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

function selectColor(colorId) {

    const updatedColors = [...props.modelValue];

    const index = updatedColors.indexOf(colorId);

    if (index > -1) {

        updatedColors.splice(index, 1);

    } else {

        updatedColors.push(colorId);

    }

    emit("update:modelValue", updatedColors);

}

</script>