<template>

    <checkoutSection number="01" title="Contact Information" subtitle="We'll use this to send your order updates."
        :icon="UserIcon">

        <div class="flex items-center gap-5">

            <!-- Avatar -->

            <img src="https://i.pravatar.cc/100?img=12" class="h-20 w-20 rounded-2xl object-cover">

            <!-- Info -->

            <div>

                <h3 class="text-xl font-semibold text-slate-900">

                    John Carter

                </h3>

                <div class="mt-2 flex flex-wrap gap-6 text-slate-600">

                    <span>

                        john@example.com

                    </span>

                    <span>

                        +1 (555) 123-4567

                    </span>

                </div>

            </div>

        </div>

    </checkoutSection>

</template>

<script setup>
import { UserIcon } from "@heroicons/vue/24/outline";
import checkoutSection from "../common/checkoutSection.vue";
</script>