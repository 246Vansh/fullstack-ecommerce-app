// Brand filter options from GET /api/products/brands ({ slug, name, names }).
// An option's id is its URL slug (?brand=levis), so links stay readable.

export const toBrandFilterOptions = (brands) => (brands ?? [])
    .filter((brand) => brand?.slug && brand?.name?.trim())
    .map(({ slug, name, names }) => ({
        id: slug,
        slug,
        name,
        names: names?.length ? names : [name],
    }));

// The ?brand= value for GET /api/products: every stored spelling of each
// selected brand, matched exactly by the API.
export const brandQueryNames = (options, ids) => options
    .filter((option) => ids.includes(option.id))
    .flatMap((option) => option.names);

// URL slugs -> selected option ids. `complete` is false when a slug names
// no brand in the catalog (the page then shows "filter not found").
export function matchBrandSlugs(options, slugs) {
    const matched = options.filter((option) => slugs.includes(option.slug));

    return { ids: matched.map((option) => option.id), complete: matched.length >= slugs.length };
}
