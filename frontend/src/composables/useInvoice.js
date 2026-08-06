import { computed } from "vue";

import { products } from "@/constants/products/products";

import { company } from "@/constants/invoice/company";
import { billing } from "@/constants/invoice/billing";
import { shipping } from "@/constants/invoice/shipping";
import { payment } from "@/constants/invoice/payment";
import { invoice } from "@/constants/invoice/invoice";
import { terms } from "@/constants/invoice/terms";

export function useInvoice() {

    const productCount = computed(() => products.length);

    const totalQuantity = computed(() =>
        products.reduce(
            (total, product) => total + product.quantity,
            0,
        ),
    );

    return {

        company,

        billing,

        shipping,

        payment,

        invoice,

        terms,

        products,

        productCount,

        totalQuantity,

    };

}