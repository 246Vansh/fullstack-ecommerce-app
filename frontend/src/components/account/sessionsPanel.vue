<template>

    <div class="space-y-6" aria-labelledby="sessions-heading" role="region">

        <div>
            <h2 id="sessions-heading" class="text-xl font-bold text-slate-900">Signed-in Devices</h2>
            <p class="mt-1 text-sm text-slate-600">
                Sessions where you're signed in. Signing a device out takes effect within 15 minutes.
            </p>
        </div>

        <p v-if="loading && !sessions.length" class="text-sm text-slate-600">Loading your sessions…</p>

        <ul v-else class="divide-y divide-slate-200 rounded-lg border border-slate-200">

            <li v-for="session in sessions" :key="session.id"
                class="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">

                <div class="text-sm">
                    <p class="font-medium text-slate-900">
                        {{ session.current ? "This device" : "Another device" }}
                        <span v-if="session.current"
                            class="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Current</span>
                    </p>
                    <p class="text-slate-600">
                        Signed in {{ formatDate(session.signedInAt) }} · Last active {{ formatDate(session.lastActiveAt) }}
                    </p>
                    <p class="text-slate-500">{{ session.persistent ? "Remembered" : "Until the browser closes" }}</p>
                </div>

                <button v-if="!session.current" type="button" :disabled="Boolean(busy)"
                    class="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    :aria-label="`Sign out device signed in ${formatDate(session.signedInAt)}`"
                    @click="$emit('revoke', session.id)">
                    {{ busy === session.id ? "Signing out…" : "Sign out" }}
                </button>

            </li>

        </ul>

        <p v-if="error" role="alert" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {{ error }}
        </p>

        <p role="status" :class="success ? 'rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800' : 'sr-only'">
            {{ success }}
        </p>

        <div class="flex flex-col gap-3 sm:flex-row">

            <button type="button" :disabled="Boolean(busy) || !hasOthers"
                class="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                @click="$emit('revoke-others')">
                {{ busy === "others" ? "Signing out…" : "Sign out all other devices" }}
            </button>

            <button type="button" :disabled="Boolean(busy)"
                class="rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                @click="$emit('logout-everywhere')">
                {{ busy === "all" ? "Signing out…" : "Sign out everywhere" }}
            </button>

        </div>

    </div>

</template>

<script setup>
import { computed } from "vue";

const props = defineProps({

    sessions: {
        type: Array,
        default: () => [],
    },

    loading: {
        type: Boolean,
        default: false,
    },

    busy: {
        type: String,
        default: "",
    },

    error: {
        type: String,
        default: "",
    },

    success: {
        type: String,
        default: "",
    },

});

defineEmits([
    "revoke",
    "revoke-others",
    "logout-everywhere",
]);

const hasOthers = computed(() => props.sessions.some((session) => !session.current));

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

const formatDate = (value) => (value ? dateFormat.format(new Date(value)) : "—");
</script>
