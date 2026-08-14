<template>
    <fieldset>

        <legend class="sr-only">
            Price
        </legend>

        <div class="space-y-4">

            <div v-for="option in options" :key="option.id" class="flex items-center">

                <input :id="`price-${option.slug}`" v-model="model" :value="option.slug" type="radio" name="price"
                    class="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />

                <label :for="`price-${option.slug}`" class="ml-3 cursor-pointer text-sm text-gray-600">
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