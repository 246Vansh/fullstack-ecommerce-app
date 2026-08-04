import googleIcon from "@/components/icons/social/googleIcon.vue";
import githubIcon from "@/components/icons/social/githubIcon.vue";

export const socialProviders = [

    {

        id: 1,
        name: "Google",
        slug: "google",
        icon: googleIcon,
        enabled: true,
        order: 1,
    },

    {
        id: 2,
        name: "GitHub",
        slug: "github",
        icon: githubIcon,
        enabled: true,
        order: 2,
    },

];