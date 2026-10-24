<template>
    <fieldset>

        <legend class="sr-only">
            Colors
        </legend>

        <div class="flex flex-wrap gap-3">

            <button v-for="color in options" :key="color.id" type="button" :aria-label="color.name" :title="color.name"
                :aria-pressed="modelValue.includes(color.id)"
                @click="selectColor(color.id)" :class="[
                    'relative flex h-10 w-10 items-center justify-center rounded-full transition-shadow duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',

                    modelValue.includes(color.id)
                        ? 'ring-2 ring-brand ring-offset-2'
                        : 'ring-1 ring-slate-300 hover:ring-slate-400'
                ]">

                <span class="h-7 w-7 rounded-full border border-black/10" :style="{ backgroundColor: color.hex }" />

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