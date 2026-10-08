import { nextTick } from "vue";

import { APP_CONFIG } from "@/config";

// "Products | E-Commerce"; the home page is just the store name.
export function setPageTitle(title) {
    document.title = title ? `${title} | ${APP_CONFIG.appName}` : APP_CONFIG.appName;
}

// Headless UI drops focus on <body> when a dialog closes. Call this from the
// transition's after-leave: once the panel (and its focus trap) has unmounted,
// focus goes back to the button that opened it, or to the new page if a link
// inside the dialog navigated. Focus already placed elsewhere is left alone.
export function restoreFocusAfterDialog(triggerId, navigated) {
    setTimeout(() => {
        if (document.activeElement && document.activeElement !== document.body) return;

        if (navigated) focusMainContent();
        else document.getElementById(triggerId)?.focus();
    });
}

// Pages that load their data render the h1 late, so a route change may have
// parked focus on <main>. Once the data is shown, move it on to the heading;
// focus the user has since moved elsewhere is left alone.
export async function focusHeadingAfterLoad() {
    await nextTick();

    if (document.activeElement?.id === "main-content") focusMainContent();
}

// Moves focus to the page's main heading, or to <main id="main-content"> while
// the heading is still loading, so keyboard and screen reader users start at
// the new page's content. preventScroll keeps the router's scroll-to-top.
export function focusMainContent() {
    const main = document.getElementById("main-content");

    if (!main) return;

    const heading = main.querySelector("h1");
    const target = heading ?? main;

    if (heading && !heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");

    target.focus({ preventScroll: true });
}
