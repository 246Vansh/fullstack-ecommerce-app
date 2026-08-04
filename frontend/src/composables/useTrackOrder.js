import { computed } from "vue";

import { products } from "@/constants/products/products";

import { order } from "@/constants/trackOrder/order";
import { shipping } from "@/constants/trackOrder/shipping";
import { delivery } from "@/constants/trackOrder/delivery";
import { timeline } from "@/constants/trackOrder/timeline";
import { supportFeatures } from "@/constants/trackOrder/support";

export function useTrackOrder() {

    const productCount = computed(() => products.length);

    const totalQuantity = computed(() =>
        products.reduce(
            (total, product) => total + product.quantity,
            0,
        ),
    );

    const orderTotal = computed(() =>
        products
            .reduce(
                (total, product) => total + product.price * product.quantity,
                0,
            )
            .toFixed(2),
    );

    return {

        order,

        shipping,

        delivery,

        timeline,

        supportFeatures,

        products,

        productCount,

        totalQuantity,

        orderTotal,

    };

}