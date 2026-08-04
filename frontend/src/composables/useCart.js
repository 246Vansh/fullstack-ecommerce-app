import { ref, computed } from "vue";
import { products as cartProducts } from "../constants/products/products";

export function useCart() {

    const products = ref([...cartProducts]);
    const taxRate = ref(0.08);
    /*
    |--------------------------------------------------------------------------
    | Computed
    |--------------------------------------------------------------------------
    */

    const subtotal = computed(() => {

        return products.value.reduce((total, product) => {

            return total + (product.price * product.quantity);

        }, 0);

    });

    const discount = computed(() => {

        return products.value.reduce((total, product) => {

            if (!product.originalPrice) {
                return total;
            }

            return total +
                ((product.originalPrice - product.price) * product.quantity);

        }, 0);

    });

    const shipping = computed(() => {

        return subtotal.value >= 100 ? 0 : 5;

    });

    const tax = computed(() => {

        return subtotal.value * taxRate.value;

    });

    const total = computed(() => {

        return subtotal.value - discount.value + shipping.value + tax.value;

    });

    /*
    |--------------------------------------------------------------------------
    | Methods
    |--------------------------------------------------------------------------
    */

    function updateQuantity({ productId, quantity }) {

        const product = products.value.find(

            item => item.id === productId

        );

        if (product) {

            product.quantity = quantity;

        }

    }

    function removeProduct(productId) {

        products.value = products.value.filter(

            product => product.id !== productId

        );

    }

    return {
        products,
        shipping,
        subtotal,
        discount,
        tax,
        total,
        updateQuantity,
        removeProduct,
    };

}