import { computed } from "vue";
import { products } from "@/constants/products/products"
import { order, shipping, payment, journey,
} from "@/constants/orderSuccess/orderData";

export function useOrderSuccess() {

    const productCount = computed(() => products.length);

    const totalQuantity = computed(() =>
        products.reduce(
            (total, product) => total + product.quantity,
            0,
        ),
    );

    return {

        order,

        shipping,

        payment,

        products,

        journey,

        productCount,

        totalQuantity,

    };

}