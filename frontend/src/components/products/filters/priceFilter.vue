<template>
    <fieldset>

        <legend class="sr-only">
            Price
        </legend>

        <div class="space-y-1">

            <div v-for="option in options" :key="option.id">

                <label :for="`price-${option.slug}`"
                    class="-mx-2 flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm text-slate-700 transition-colors duration-150 hover:bg-slate-50">
                    <input :id="`price-${option.slug}`" v-model="model" :value="option.slug" type="radio" name="price"
                        class="h-4.5 w-4.5 shrink-0 cursor-pointer accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" />
                    {{ option.label }}
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

});

const model = defineModel({

    type: String,
    default: null,

});
</script>