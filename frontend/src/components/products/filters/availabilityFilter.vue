<template>
    <fieldset>

        <legend class="sr-only">
            Availability
        </legend>

        <div class="space-y-1">
            <div v-for="availability in options" :key="availability.id">
                <label :for="`availability-${availability.id}`"
                    class="-mx-2 flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm text-slate-700 transition-colors duration-150 hover:bg-slate-50">
                    <input :id="`availability-${availability.id}`" type="checkbox" :checked="modelValue.includes(availability.id)"
                        class="h-4.5 w-4.5 shrink-0 cursor-pointer rounded accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        @change="toggleAvailability(availability.id)" />
                    {{ availability.name }}
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

function toggleAvailability(availabilityId) {

    const updatedAvailability = [...props.modelValue];
    const index = updatedAvailability.indexOf(availabilityId);

    if (index > -1) {
        updatedAvailability.splice(index, 1);

    } else {
        updatedAvailability.push(availabilityId);

    }

    emit("update:modelValue", updatedAvailability);

}

</script>