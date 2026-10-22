<template>

    <form ref="formEl" class="space-y-6" novalidate aria-labelledby="profile-heading" @submit.prevent="$emit('submit')">

        <div>
            <h2 id="profile-heading" class="text-xl font-bold text-slate-900">Profile</h2>
            <p class="mt-1 text-sm text-slate-600">Signed in as <span class="wrap-anywhere font-medium">{{ email }}</span></p>
        </div>

        <div class="grid gap-6 sm:grid-cols-2">

            <authInput id="profile-first-name" v-model="firstName" label="First Name" autocomplete="given-name" required
                :error="errors.firstName" />

            <authInput id="profile-last-name" v-model="lastName" label="Last Name" autocomplete="family-name" required
                :error="errors.lastName" />

        </div>

        <authInput id="profile-phone" v-model="phone" type="tel" label="Phone" autocomplete="tel"
            helper="Optional. Leave empty to remove it." :error="errors.phone" />

        <p v-if="errors.form" role="alert" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {{ errors.form }}
        </p>

        <p role="status" :class="success ? 'rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800' : 'sr-only'">
            {{ success }}
        </p>

        <authButton type="submit" :loading="loading" class="sm:w-auto sm:px-8">
            Save Profile
        </authButton>

    </form>

</template>

<script setup>
import { ref } from "vue";

import authInput from "@/components/auth/fields/authInput.vue";
import authButton from "@/components/auth/ui/authButton.vue";

import { useFocusFirstError } from "@/composables/useFocusFirstError";

const props = defineProps({

    email: {
        type: String,
        default: "",
    },

    errors: {
        type: Object,
        default: () => ({}),
    },

    loading: {
        type: Boolean,
        default: false,
    },

    success: {
        type: String,
        default: "",
    },

});

const firstName = defineModel("firstName");

const lastName = defineModel("lastName");

const phone = defineModel("phone");

defineEmits([
    "submit",
]);

// After a failed submit, focus goes to the first field with an error.
const formEl = ref(null);

useFocusFirstError(formEl, () => props.errors);
</script>
