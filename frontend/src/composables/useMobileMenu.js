import { ref } from "vue";

const open = ref(false);

export function useMobileMenu() {

    const openMenu = () => {
        open.value = true;
    };

    const closeMenu = () => {
        open.value = false;
    };

    const toggleMenu = () => {
        open.value = !open.value;
    };

    return {
        open,
        openMenu,
        closeMenu,
        toggleMenu,
    };
}