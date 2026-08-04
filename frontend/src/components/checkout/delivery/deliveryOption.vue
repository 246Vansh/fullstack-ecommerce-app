<template>

    <button @click="$emit('select', option.id)" :class="[
        'flex w-full items-center justify-between rounded-2xl border p-6 text-left transition-all duration-300 cursor-pointer',

        selected
            ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100'
            : 'border-gray-200 bg-white hover:border-indigo-300'
    ]">

        <!-- Left -->

        <div class="flex items-center gap-5">

            <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-white">

                <component :is="option.icon" class="h-8 w-8 text-indigo-600" />

            </div>

            <div>

                <h3 class="text-lg font-semibold text-slate-900">

                    {{ option.name }}

                </h3>

                <p class="mt-1 text-slate-500">

                    {{ option.description }}

                </p>

                <p class="mt-2 font-semibold text-indigo-600">

                    {{ option.price }}

                </p>

            </div>

        </div>

        <!-- Radio -->

        <div :class="[
            'flex h-7 w-7 items-center justify-center rounded-full border-2',

            selected
                ? 'border-indigo-600'
                : 'border-gray-300'
        ]">

            <div v-if="selected" class="h-3 w-3 rounded-full bg-indigo-600">
            </div>

        </div>

    </button>

</template>

<script setup>

defineProps({

    option: Object,

    selected: Boolean,

});

defineEmits([
    "select",
]);
</script>