<template>
    <fieldset>

        <legend class="sr-only">
            Availability
        </legend>

        <div class="space-y-4">
            <div v-for="availability in options" :key="availability.id" class="flex items-center">
                <input :id="`availability-${availability.id}`" type="checkbox"
                    :checked="modelValue.includes(availability.id)"
                    class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    @change="toggleAvailability(availability.id)" />

                <label :for="`availability-${availability.id}`" class="ml-3 text-sm text-gray-600">
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