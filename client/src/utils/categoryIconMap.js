// GreenCart Category Architecture & Icon Metadata Mapping

export const DEPARTMENT_DEFINITIONS = [
    {
        id: "vegetables",
        name: "Fresh Vegetables",
        path: "Vegetables",
        tag: "Farm Fresh",
        sublabel: "Organic & Crisp",
        iconKey: "vegetables",
        accentBg: "from-emerald-50 via-teal-50/50 to-white",
        cardBorder: "border-emerald-200/80 hover:border-emerald-500",
        badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
        iconRing: "from-emerald-400/20 to-teal-400/10 ring-emerald-200/60"
    },
    {
        id: "fruits",
        name: "Fresh Fruits",
        path: "Fruits",
        tag: "Vitamin Rich",
        sublabel: "Juicy & Sweet",
        iconKey: "fruits",
        accentBg: "from-rose-50 via-amber-50/40 to-white",
        cardBorder: "border-rose-200/80 hover:border-rose-500",
        badgeColor: "bg-rose-100 text-rose-800 border-rose-200",
        iconRing: "from-rose-400/20 to-amber-400/10 ring-rose-200/60"
    },
    {
        id: "dairy",
        name: "Dairy & Chilled Items",
        path: "Dairy",
        tag: "Daily Pure",
        sublabel: "Milk, Butter & Cheese",
        iconKey: "dairy",
        accentBg: "from-sky-50 via-blue-50/40 to-white",
        cardBorder: "border-sky-200/80 hover:border-sky-500",
        badgeColor: "bg-sky-100 text-sky-800 border-sky-200",
        iconRing: "from-sky-400/20 to-blue-400/10 ring-sky-200/60"
    },
    {
        id: "drinks",
        name: "Snacks & Beverages",
        path: "Drinks",
        tag: "Chilled Drinks",
        sublabel: "Juices, Sodas & Tea",
        iconKey: "drinks",
        accentBg: "from-teal-50 via-cyan-50/40 to-white",
        cardBorder: "border-teal-200/80 hover:border-teal-500",
        badgeColor: "bg-teal-100 text-teal-800 border-teal-200",
        iconRing: "from-teal-400/20 to-cyan-400/10 ring-teal-200/60"
    },
    {
        id: "instant",
        name: "Instant Food & Meals",
        path: "Instant",
        tag: "Quick Meals",
        sublabel: "Noodles, Soups & Pasta",
        iconKey: "instant",
        accentBg: "from-orange-50 via-amber-50/40 to-white",
        cardBorder: "border-orange-200/80 hover:border-orange-500",
        badgeColor: "bg-orange-100 text-orange-800 border-orange-200",
        iconRing: "from-orange-400/20 to-amber-400/10 ring-orange-200/60"
    },
    {
        id: "bakery",
        name: "Bakery & Fresh Bread",
        path: "Bakery",
        tag: "Oven Baked",
        sublabel: "Bread, Buns & Pastries",
        iconKey: "bakery",
        accentBg: "from-amber-50 via-yellow-50/40 to-white",
        cardBorder: "border-amber-200/80 hover:border-amber-500",
        badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
        iconRing: "from-amber-400/20 to-yellow-400/10 ring-amber-200/60"
    },
    {
        id: "grains",
        name: "Rice & Grains",
        path: "Grains",
        tag: "Pantry Staples",
        sublabel: "Basmati, Lentils & Flour",
        iconKey: "grains",
        accentBg: "from-yellow-50 via-lime-50/30 to-white",
        cardBorder: "border-yellow-200/80 hover:border-yellow-500",
        badgeColor: "bg-yellow-100 text-yellow-800 border-yellow-200",
        iconRing: "from-yellow-400/20 to-lime-400/10 ring-yellow-200/60"
    },
    {
        id: "cooking",
        name: "Cooking Essentials",
        path: "Cooking",
        tag: "Kitchen Oils",
        sublabel: "Pure Oils, Spices & Ghee",
        iconKey: "cooking",
        accentBg: "from-amber-50 via-orange-50/40 to-white",
        cardBorder: "border-amber-200/80 hover:border-amber-500",
        badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
        iconRing: "from-amber-400/20 to-orange-400/10 ring-amber-200/60"
    },
    {
        id: "meat-fish",
        name: "Meat & Fish",
        path: "Meat",
        tag: "Fresh Catch",
        sublabel: "Cleaned & Chilled",
        iconKey: "meat-fish",
        accentBg: "from-indigo-50 via-cyan-50/40 to-white",
        cardBorder: "border-indigo-200/80 hover:border-indigo-500",
        badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-200",
        iconRing: "from-indigo-400/20 to-cyan-400/10 ring-indigo-200/60"
    },
    {
        id: "frozen",
        name: "Frozen Foods",
        path: "Frozen",
        tag: "Keep Chilled",
        sublabel: "Peas, Berries & Ice Cream",
        iconKey: "frozen",
        accentBg: "from-blue-50 via-cyan-50/40 to-white",
        cardBorder: "border-blue-200/80 hover:border-blue-500",
        badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
        iconRing: "from-blue-400/20 to-cyan-400/10 ring-blue-200/60"
    },
    {
        id: "household",
        name: "Household Essentials",
        path: "Household",
        tag: "Clean Home",
        sublabel: "Detergents & Cleaners",
        iconKey: "household",
        accentBg: "from-violet-50 via-teal-50/40 to-white",
        cardBorder: "border-violet-200/80 hover:border-violet-500",
        badgeColor: "bg-violet-100 text-violet-800 border-violet-200",
        iconRing: "from-violet-400/20 to-teal-400/10 ring-violet-200/60"
    },
    {
        id: "personal",
        name: "Personal Care",
        path: "Personal",
        tag: "Self Care",
        sublabel: "Soaps, Shampoos & Creams",
        iconKey: "personal",
        accentBg: "from-fuchsia-50 via-rose-50/40 to-white",
        cardBorder: "border-fuchsia-200/80 hover:border-fuchsia-500",
        badgeColor: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
        iconRing: "from-fuchsia-400/20 to-rose-400/10 ring-fuchsia-200/60"
    },
    {
        id: "baby",
        name: "Baby Care",
        path: "Baby",
        tag: "Gentle Care",
        sublabel: "Diapers, Formula & Wipes",
        iconKey: "baby",
        accentBg: "from-pink-50 via-sky-50/40 to-white",
        cardBorder: "border-pink-200/80 hover:border-pink-500",
        badgeColor: "bg-pink-100 text-pink-800 border-pink-200",
        iconRing: "from-pink-400/20 to-sky-400/10 ring-pink-200/60"
    },
    {
        id: "eggs",
        name: "Farm Eggs & Poultry",
        path: "Eggs",
        tag: "High Protein",
        sublabel: "Fresh Layer Eggs",
        iconKey: "eggs",
        accentBg: "from-lime-50 via-emerald-50/30 to-white",
        cardBorder: "border-lime-200/80 hover:border-lime-500",
        badgeColor: "bg-lime-100 text-lime-800 border-lime-200",
        iconRing: "from-lime-400/20 to-emerald-400/10 ring-lime-200/60"
    }
];

/**
 * Resolves iconKey and styling metadata for any given category string.
 * Handles fuzzy name matching, database categories, and custom additions.
 */
export const resolveCategoryMeta = (rawName = "") => {
    if (!rawName) return DEPARTMENT_DEFINITIONS[0];
    const s = String(rawName).trim().toLowerCase();

    // Direct path or name match
    const exact = DEPARTMENT_DEFINITIONS.find(
        d => d.path.toLowerCase() === s || d.name.toLowerCase() === s || d.id === s
    );
    if (exact) return exact;

    // Fuzzy matching keywords
    if (s.includes("veg") || s.includes("spinach") || s.includes("potato") || s.includes("tomato") || s.includes("onion") || s.includes("green")) {
        return DEPARTMENT_DEFINITIONS.find(d => d.iconKey === "vegetables");
    }
    if (s.includes("fruit") || s.includes("apple") || s.includes("banana") || s.includes("orange") || s.includes("mango") || s.includes("grape")) {
        return DEPARTMENT_DEFINITIONS.find(d => d.iconKey === "fruits");
    }
    if (s.includes("dairy") || s.includes("milk") || s.includes("cheese") || s.includes("paneer") || s.includes("curd") || s.includes("yogurt")) {
        return DEPARTMENT_DEFINITIONS.find(d => d.iconKey === "dairy");
    }
    if (s.includes("meat") || s.includes("fish") || s.includes("chicken") || s.includes("beef") || s.includes("mutton") || s.includes("prawn")) {
        return DEPARTMENT_DEFINITIONS.find(d => d.iconKey === "meat-fish");
    }
    if (s.includes("bread") || s.includes("bakery") || s.includes("cake") || s.includes("croissant") || s.includes("muffin") || s.includes("toast")) {
        return DEPARTMENT_DEFINITIONS.find(d => d.iconKey === "bakery");
    }
    if (s.includes("grain") || s.includes("rice") || s.includes("cereal") || s.includes("flour") || s.includes("wheat") || s.includes("oat") || s.includes("dal")) {
        return DEPARTMENT_DEFINITIONS.find(d => d.iconKey === "grains");
    }
    if (s.includes("cook") || s.includes("oil") || s.includes("ghee") || s.includes("spice") || s.includes("masala") || s.includes("salt") || s.includes("sugar")) {
        return DEPARTMENT_DEFINITIONS.find(d => d.iconKey === "cooking");
    }
    if (s.includes("drink") || s.includes("beverage") || s.includes("juice") || s.includes("soda") || s.includes("coke") || s.includes("snack") || s.includes("chip")) {
        return DEPARTMENT_DEFINITIONS.find(d => d.iconKey === "drinks");
    }
    if (s.includes("instant") || s.includes("noodle") || s.includes("maggi") || s.includes("ramen") || s.includes("soup") || s.includes("pasta")) {
        return DEPARTMENT_DEFINITIONS.find(d => d.iconKey === "instant");
    }
    if (s.includes("frozen") || s.includes("ice") || s.includes("frost")) {
        return DEPARTMENT_DEFINITIONS.find(d => d.iconKey === "frozen");
    }
    if (s.includes("house") || s.includes("clean") || s.includes("wash") || s.includes("detergent") || s.includes("dish")) {
        return DEPARTMENT_DEFINITIONS.find(d => d.iconKey === "household");
    }
    if (s.includes("care") || s.includes("soap") || s.includes("shampoo") || s.includes("lotion") || s.includes("skin") || s.includes("personal")) {
        return DEPARTMENT_DEFINITIONS.find(d => d.iconKey === "personal");
    }
    if (s.includes("baby") || s.includes("infant") || s.includes("diaper")) {
        return DEPARTMENT_DEFINITIONS.find(d => d.iconKey === "baby");
    }
    if (s.includes("egg") || s.includes("poultry")) {
        return DEPARTMENT_DEFINITIONS.find(d => d.iconKey === "eggs");
    }

    // Safe fallback configuration
    return {
        id: s,
        name: rawName,
        path: rawName,
        tag: "Specialty",
        sublabel: "GreenCart Select",
        iconKey: "default",
        accentBg: "from-slate-50 via-emerald-50/30 to-white",
        cardBorder: "border-slate-200/80 hover:border-emerald-500",
        badgeColor: "bg-slate-100 text-slate-800 border-slate-200",
        iconRing: "from-emerald-400/20 to-slate-400/10 ring-slate-200/60"
    };
};
