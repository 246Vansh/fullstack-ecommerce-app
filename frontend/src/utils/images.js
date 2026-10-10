// Catalog photos are Unsplash originals (up to ~8000px wide). Decoding a
// dozen of those froze the products page for up to a second, so ask
// Unsplash's image API for a rendition at the width we display. Other URLs
// are returned unchanged.
const UNSPLASH = /^https:\/\/images\.unsplash\.com\//;

export function sizedImage(url, width) {
    if (!url || !UNSPLASH.test(url)) return url;

    const sized = new URL(url);

    sized.searchParams.set("auto", "format");
    sized.searchParams.set("fit", "crop");
    sized.searchParams.set("w", String(width));
    sized.searchParams.set("q", "80");

    return sized.toString();
}

// "…&w=400 400w, …&w=800 800w" for <img srcset>; undefined for other URLs.
export function sizedImageSrcset(url, widths) {
    if (!url || !UNSPLASH.test(url)) return undefined;

    return widths.map((width) => `${sizedImage(url, width)} ${width}w`).join(", ");
}
