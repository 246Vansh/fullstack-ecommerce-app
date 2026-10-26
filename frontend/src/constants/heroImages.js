// Homepage hero photos (Unsplash, so utils/images.js can request each at the
// width it is shown). The hero shows one set of three at a time and moves to
// the next set every HERO_ROTATE_MS (components/home/hero/heroSection.vue).
// In each set the first photo is the large tile (tall from lg), so it is a
// portrait shot; the other two fill square tiles, so their subject is
// centred. Chosen to show no third-party logos or labels. They are
// decorative: the hero's text and links say what the store sells.
export const HERO_ROTATE_MS = 60 * 100;

export const heroImageSets = [
    [
        // Woman in a coat carrying shopping bags (the Women category photo).
        { id: "women", src: "https://images.unsplash.com/photo-1483985988355-763728e1935b" },
        // Woman in round sunglasses against a yellow wall.
        { id: "sunglasses", src: "https://images.unsplash.com/photo-1469334031218-e382a71b716b" },
        // A pair of floral high heels on a pale blue set.
        { id: "heels", src: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2" },
    ],
    [
        // Woman in a pale blue coat in a cathedral square.
        { id: "blue-coat", src: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b" },
        // Round sunglasses on a white marble surface.
        { id: "round-sunglasses", src: "https://images.unsplash.com/photo-1511499767150-a48a237f0083" },
        // Man in a jacket and chinos sitting in a round window.
        { id: "round-window", src: "https://images.unsplash.com/photo-1488161628813-04466f872be2" },
    ],
    [
        // Woman in a check coat carrying a studded bag on a street.
        { id: "studded-bag", src: "https://images.unsplash.com/photo-1485968579580-b6d095142e6e" },
        // Man in a brown leather jacket and sunglasses.
        { id: "leather-jacket", src: "https://images.unsplash.com/photo-1487222477894-8943e31ef7b2" },
        // A rust bomber jacket held up on a hanger.
        { id: "bomber", src: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea" },
    ],
    [
        // Woman in a yellow tracksuit on an outdoor court.
        { id: "tracksuit", src: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f" },
        // Floral wrap dress and a straw bag by the sea.
        { id: "floral-dress", src: "https://images.unsplash.com/photo-1496747611176-843222e1e57c" },
        // A cream crochet poncho on a hanger.
        { id: "poncho", src: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105" },
    ],
];
