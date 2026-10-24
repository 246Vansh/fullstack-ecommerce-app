<template>
    <fieldset>

        <legend class="sr-only">Categories</legend>

        <div class="space-y-1">
            <div v-for="category in options" :key="category.id">
                <label :for="`category-${category.id}`"
                    class="-mx-2 flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm text-slate-700 transition-colors duration-150 hover:bg-slate-50">
                    <input :id="`category-${category.id}`" type="checkbox" :checked="modelValue.includes(category.id)"
                        class="h-4.5 w-4.5 shrink-0 cursor-pointer rounded accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        @change="toggleCategory(category.id)" />
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