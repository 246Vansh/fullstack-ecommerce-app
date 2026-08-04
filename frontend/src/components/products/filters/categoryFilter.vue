<template>
    <fieldset>

        <legend class="sr-only">Categories</legend>

        <div class="space-y-4">
            <div v-for="category in options" :key="category.id" class="flex items-center">
                <input :id="`category-${category.id}`" type="checkbox" :checked="modelValue.includes(category.id)"
                    class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    @change="toggleCategory(category.id)" />

                <label :for="`category-${category.id}`" class="ml-3 text-sm text-gray-600">
                    {{ category.name }}
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

function toggleCategory(categoryId) {

    const updatedCategories = [...props.modelValue];
    const index = updatedCategories.indexOf(categoryId);

    if (index > -1) {
        updatedCategories.splice(index, 1);

    } else {
        updatedCategories.push(categoryId);

    }

    emit("update:modelValue", updatedCategories);

}

</script>