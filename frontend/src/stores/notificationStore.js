import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";

import { notificationService } from "@/services/notificationService";
import { parseApiError } from "@/services/apiClient";
import { useAuthStore } from "./authStore";

// The header dropdown shows the latest few; the page loads more in pages.
export const RECENT_LIMIT = 6;
export const PAGE_SIZE = 20;

const POLL_INTERVAL = 60_000;

const isVisible = () => typeof document === "undefined" || document.visibilityState === "visible";

/*
| Signed-in users only. Everything is cleared whenever the signed-in user
| changes (logout, another account in another tab): `generation` is bumped,
| and a response that started for the previous user is dropped on arrival,
| so one account's notifications are never shown to the next.
|
| The unread count always comes from the server (every response carries it),
| never from counting the loaded lists.
*/
export const useNotificationStore = defineStore("notifications", () => {

    const auth = useAuthStore();

    const unreadCount = ref(0);

    // Header dropdown: the newest RECENT_LIMIT.
    const recent = ref([]);
    const recentLoaded = ref(false);
    const loadingRecent = ref(false);
    const recentError = ref("");

    // Notifications page: newest first, extended with loadMore().
    const items = ref([]);
    const pagination = ref(null);
    const loadingList = ref(false);
    const listError = ref("");

    const markingAll = ref(false);
    const actionError = ref("");

    const hasMore = computed(() => Boolean(pagination.value && pagination.value.page < pagination.value.totalPages));

    let generation = 0;
    let countRequest = null;
    let recentRequest = null;
    let listRequest = 0;
    const pendingReads = new Set();

    function reset() {
        generation++;
        countRequest = null;
        recentRequest = null;
        listRequest++;
        pendingReads.clear();

        unreadCount.value = 0;
        recent.value = [];
        recentLoaded.value = false;
        loadingRecent.value = false;
        recentError.value = "";
        items.value = [];
        pagination.value = null;
        loadingList.value = false;
        listError.value = "";
        markingAll.value = false;
        actionError.value = "";
    }

    // Concurrent callers (poll, tab focus, bell) share one request.
    function refreshUnreadCount() {
        if (!auth.isAuthenticated) return Promise.resolve();
        if (countRequest) return countRequest;

        const started = generation;

        const request = notificationService.getUnreadCount()
            .then((count) => {
                if (started === generation) unreadCount.value = count;
            })
            // Keep the last known count; the next poll tries again.
            .catch(() => {})
            .finally(() => {
                if (countRequest === request) countRequest = null;
            });

        countRequest = request;
        return request;
    }

    // Each time the dropdown opens; an open one shares the request in flight.
    function fetchRecent() {
        if (!auth.isAuthenticated) return Promise.resolve();
        if (recentRequest) return recentRequest;

        const started = generation;
        loadingRecent.value = true;
        recentError.value = "";

        const request = notificationService.list({ page: 1, limit: RECENT_LIMIT })
            .then((result) => {
                if (started !== generation) return;
                recent.value = result.notifications;
                unreadCount.value = result.unreadCount;
                recentLoaded.value = true;
            })
            .catch((error) => {
                if (started === generation) recentError.value = parseApiError(error).message;
            })
            .finally(() => {
                if (recentRequest !== request) return;
                recentRequest = null;
                loadingRecent.value = false;
            });

        recentRequest = request;
        return request;
    }

    // The first page (replacing the list), or the next one ({ more: true }).
    // Only the newest request may update the list.
    async function loadNotifications({ more = false } = {}) {
        if (!auth.isAuthenticated) return;

        const page = more && pagination.value ? pagination.value.page + 1 : 1;
        const request = ++listRequest;
        const started = generation;

        loadingList.value = true;
        listError.value = "";

        // A fresh first page starts from nothing, so an error then always
        // means "nothing loaded" and its retry reloads page 1.
        if (!more) {
            items.value = [];
            pagination.value = null;
        }

        try {
            const result = await notificationService.list({ page, limit: PAGE_SIZE });

            if (request !== listRequest || started !== generation) return;

            // New notifications push older ones onto later pages, so the next
            // page can repeat a few already shown.
            const shown = new Set(items.value.map((notification) => notification.id));

            items.value = more
                ? [...items.value, ...result.notifications.filter((notification) => !shown.has(notification.id))]
                : result.notifications;
            pagination.value = result.pagination;
            unreadCount.value = result.unreadCount;
        } catch (error) {
            if (request === listRequest && started === generation) listError.value = parseApiError(error).message;
        } finally {
            if (request === listRequest) loadingList.value = false;
        }
    }

    // The same notification can be in both lists.
    function replaceNotification(updated) {
        for (const list of [recent, items]) {
            list.value = list.value.map((notification) => (notification.id === updated.id ? updated : notification));
        }
    }

    const findNotification = (id) => recent.value.find((n) => n.id === id) ?? items.value.find((n) => n.id === id);

    // -> true when the notification is (now) read.
    async function markRead(id) {
        if (findNotification(id)?.readAt) return true;
        if (pendingReads.has(id)) return false;

        const started = generation;
        pendingReads.add(id);
        actionError.value = "";

        try {
            const { notification, unreadCount: count } = await notificationService.markRead(id);

            if (started !== generation) return false;

            replaceNotification(notification);
            unreadCount.value = count;
            return true;
        } catch (error) {
            if (started === generation) actionError.value = parseApiError(error).message;
            return false;
        } finally {
            if (started === generation) pendingReads.delete(id);
        }
    }

    // Up to the newest notification on screen, so one arriving meanwhile stays unread.
    async function markAllRead() {
        if (markingAll.value || !auth.isAuthenticated) return;

        const ids = [...recent.value, ...items.value].map((notification) => notification.id);
        const upToId = ids.length ? Math.max(...ids) : undefined;
        const started = generation;

        markingAll.value = true;
        actionError.value = "";

        try {
            const { unreadCount: count } = await notificationService.markAllRead(upToId);

            if (started !== generation) return;

            const readAt = new Date().toISOString();
            const markRead = (notification) => (!notification.readAt && (upToId === undefined || notification.id <= upToId)
                ? { ...notification, readAt }
                : notification);

            recent.value = recent.value.map(markRead);
            items.value = items.value.map(markRead);
            unreadCount.value = count;
        } catch (error) {
            if (started === generation) actionError.value = parseApiError(error).message;
        } finally {
            if (started === generation) markingAll.value = false;
        }
    }

    /*
    | Polling: one interval for the whole app, running only while someone has
    | started it (App.vue), a user is signed in and the tab is visible. A tab
    | that becomes visible again refreshes at once and restarts the interval.
    | startPolling() is reference counted and returns its own stop function.
    */

    let pollTimer = null;
    let pollers = 0;

    function schedulePolling() {
        clearInterval(pollTimer);
        pollTimer = null;

        if (pollers > 0 && auth.isAuthenticated && isVisible()) {
            pollTimer = setInterval(refreshUnreadCount, POLL_INTERVAL);
        }
    }

    function onVisibilityChange() {
        if (isVisible()) refreshUnreadCount();
        schedulePolling();
    }

    function startPolling() {
        if (pollers++ === 0) document.addEventListener("visibilitychange", onVisibilityChange);
        schedulePolling();

        let stopped = false;

        return function stopPolling() {
            if (stopped) return;
            stopped = true;

            if (--pollers === 0) document.removeEventListener("visibilitychange", onVisibilityChange);
            schedulePolling();
        };
    }

    // A different user (or none): start from nothing, then fetch their count.
    watch(() => auth.user?.id, (userId, previousId) => {
        if (userId !== previousId) {
            reset();
            if (userId) refreshUnreadCount();
        }

        schedulePolling();
    }, { immediate: true });

    return {
        unreadCount,
        recent,
        recentLoaded,
        loadingRecent,
        recentError,
        items,
        pagination,
        loadingList,
        listError,
        hasMore,
        markingAll,
        actionError,
        refreshUnreadCount,
        fetchRecent,
        loadNotifications,
        markRead,
        markAllRead,
        startPolling,
    };

});
