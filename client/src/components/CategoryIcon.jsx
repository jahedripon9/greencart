import React from 'react';
import { resolveCategoryMeta } from '../utils/categoryIconMap';

/**
 * Modern Custom Illustrated Category Icons
 * Style: Colorful duotone & soft 3D-inspired vector illustrations with coordinated gradient badges.
 */

const BroccoliLeafIcon = ({ id = "veg" }) => (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
        <defs>
            <linearGradient id={`${id}-floret1`} x1="16" y1="12" x2="38" y2="34" gradientUnits="userSpaceOnUse">
                <stop stopColor="#34D399" />
                <stop offset="1" stopColor="#059669" />
            </linearGradient>
            <linearGradient id={`${id}-floret2`} x1="28" y1="8" x2="52" y2="30" gradientUnits="userSpaceOnUse">
                <stop stopColor="#10B981" />
                <stop offset="1" stopColor="#047857" />
            </linearGradient>
            <linearGradient id={`${id}-stem`} x1="26" y1="30" x2="38" y2="54" gradientUnits="userSpaceOnUse">
                <stop stopColor="#A7F3D0" />
                <stop offset="1" stopColor="#10B981" />
            </linearGradient>
            <linearGradient id={`${id}-leaf`} x1="36" y1="28" x2="56" y2="44" gradientUnits="userSpaceOnUse">
                <stop stopColor="#6EE7B7" />
                <stop offset="1" stopColor="#059669" />
            </linearGradient>
        </defs>
        {/* Soft shadow ellipse */}
        <ellipse cx="32" cy="56" rx="16" ry="3.5" fill="#047857" opacity="0.12" />
        {/* Stalk */}
        <path d="M26 33C26 33 24 45 28 52C29.5 54.5 34.5 54.5 36 52C40 45 38 33 38 33H26Z" fill={`url(#${id}-stem)`} />
        <path d="M28 35C29 44 31 50 32 53" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
        {/* Main Broccoli Florets */}
        <circle cx="23" cy="25" r="11" fill={`url(#${id}-floret1)`} />
        <circle cx="41" cy="25" r="11" fill={`url(#${id}-floret2)`} />
        <circle cx="32" cy="18" r="12" fill={`url(#${id}-floret1)`} />
        <circle cx="32" cy="27" r="9" fill={`url(#${id}-floret2)`} />
        {/* Highlights & Texture */}
        <circle cx="28" cy="15" r="3.5" fill="#A7F3D0" opacity="0.6" />
        <circle cx="39" cy="20" r="2.5" fill="#A7F3D0" opacity="0.5" />
        <circle cx="20" cy="23" r="2.5" fill="#A7F3D0" opacity="0.5" />
        {/* Curved crisp leaf */}
        <path d="M37 36C44 34 52 38 52 46C44 48 38 43 37 36Z" fill={`url(#${id}-leaf)`} />
        <path d="M37 36C43 38 48 42 51 46" stroke="#047857" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
    </svg>
);

const FruitOrangeAppleIcon = ({ id = "fruits" }) => (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
        <defs>
            <linearGradient id={`${id}-apple`} x1="16" y1="18" x2="42" y2="52" gradientUnits="userSpaceOnUse">
                <stop stopColor="#F87171" />
                <stop offset="0.6" stopColor="#EF4444" />
                <stop offset="1" stopColor="#B91C1C" />
            </linearGradient>
            <linearGradient id={`${id}-orange`} x1="30" y1="28" x2="54" y2="52" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FBBF24" />
                <stop offset="0.6" stopColor="#F59E0B" />
                <stop offset="1" stopColor="#D97706" />
            </linearGradient>
            <linearGradient id={`${id}-leaf`} x1="28" y1="8" x2="38" y2="20" gradientUnits="userSpaceOnUse">
                <stop stopColor="#34D399" />
                <stop offset="1" stopColor="#059669" />
            </linearGradient>
        </defs>
        {/* Soft base shadows */}
        <ellipse cx="28" cy="54" rx="14" ry="3.5" fill="#B91C1C" opacity="0.14" />
        <ellipse cx="44" cy="53" rx="10" ry="3" fill="#D97706" opacity="0.14" />
        {/* Apple Body */}
        <path d="M28 20C25 18 19 20 16 26C12 34 16 48 24 51C27 52 28 50 30 50C32 50 33 52 36 51C44 48 46 36 43 28C40 22 34 18 28 20Z" fill={`url(#${id}-apple)`} />
        {/* Apple Highlight */}
        <path d="M19 26C16 31 16 39 19 44" stroke="#FECACA" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
        {/* Stem & Leaf */}
        <path d="M28 20C28 16 30 13 32 10" stroke="#78350F" strokeWidth="2" strokeLinecap="round" />
        <path d="M30 14C35 12 39 14 40 18C35 19 32 17 30 14Z" fill={`url(#${id}-leaf)`} />
        {/* Orange Wedge / Citrus Slice Front */}
        <circle cx="44" cy="40" r="12" fill={`url(#${id}-orange)`} />
        <circle cx="44" cy="40" r="10" fill="#FEF3C7" />
        <circle cx="44" cy="40" r="8.5" fill="#F59E0B" />
        {/* Orange Segments */}
        <circle cx="44" cy="40" r="2" fill="#FEF3C7" />
        <path d="M44 32V48M36 40H52M38 34L50 46M38 46L50 34" stroke="#FEF3C7" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
);

const MilkBottleIcon = ({ id = "dairy" }) => (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
        <defs>
            <linearGradient id={`${id}-bottle`} x1="20" y1="12" x2="44" y2="54" gradientUnits="userSpaceOnUse">
                <stop stopColor="#F0F9FF" />
                <stop offset="0.4" stopColor="#E0F2FE" />
                <stop offset="1" stopColor="#BAE6FD" />
            </linearGradient>
            <linearGradient id={`${id}-milk`} x1="22" y1="26" x2="42" y2="54" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FFFFFF" />
                <stop offset="1" stopColor="#E2E8F0" />
            </linearGradient>
            <linearGradient id={`${id}-cap`} x1="26" y1="8" x2="38" y2="14" gradientUnits="userSpaceOnUse">
                <stop stopColor="#38BDF8" />
                <stop offset="1" stopColor="#0284C7" />
            </linearGradient>
            <linearGradient id={`${id}-label`} x1="23" y1="33" x2="41" y2="44" gradientUnits="userSpaceOnUse">
                <stop stopColor="#60A5FA" />
                <stop offset="1" stopColor="#2563EB" />
            </linearGradient>
        </defs>
        <ellipse cx="32" cy="55" rx="14" ry="3.5" fill="#0284C7" opacity="0.14" />
        {/* Glass Bottle Outline & Body */}
        <path d="M27 14H37V18C37 22 42 25 43 30L44 49C44 52 41 54 38 54H26C23 54 20 52 20 49L21 30C22 25 27 22 27 18V14Z" fill={`url(#${id}-bottle)`} stroke="#7DD3FC" strokeWidth="1.5" />
        {/* Milk Content inside */}
        <path d="M22 31C24 30 27 32 30 31C33 30 36 32 42 31L43 49C43 51 40 53 37 53H27C24 53 21 51 21 49L22 31Z" fill={`url(#${id}-milk)`} />
        {/* Blue Cap */}
        <rect x="26" y="8" width="12" height="6" rx="2" fill={`url(#${id}-cap)`} />
        <rect x="25" y="12" width="14" height="2" rx="1" fill="#0284C7" />
        {/* Brand Dairy Label */}
        <rect x="24" y="35" width="16" height="10" rx="2" fill={`url(#${id}-label)`} />
        <path d="M27 40H37M29 38H35M30 42H34" stroke="#EFF6FF" strokeWidth="1.2" strokeLinecap="round" />
        {/* Glass Sheen */}
        <path d="M23 28L23 48" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
        {/* Splash Droplets */}
        <circle cx="47" cy="22" r="2" fill="#38BDF8" />
        <circle cx="17" cy="26" r="1.5" fill="#38BDF8" opacity="0.7" />
    </svg>
);

const FishIllustrationIcon = ({ id = "meat-fish" }) => (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
        <defs>
            <linearGradient id={`${id}-fish`} x1="12" y1="20" x2="52" y2="44" gradientUnits="userSpaceOnUse">
                <stop stopColor="#38BDF8" />
                <stop offset="0.5" stopColor="#0284C7" />
                <stop offset="1" stopColor="#1E40AF" />
            </linearGradient>
            <linearGradient id={`${id}-belly`} x1="20" y1="32" x2="40" y2="44" gradientUnits="userSpaceOnUse">
                <stop stopColor="#E0F2FE" />
                <stop offset="1" stopColor="#7DD3FC" />
            </linearGradient>
            <linearGradient id={`${id}-fin`} x1="30" y1="12" x2="42" y2="24" gradientUnits="userSpaceOnUse">
                <stop stopColor="#F472B6" />
                <stop offset="1" stopColor="#EC4899" />
            </linearGradient>
        </defs>
        <ellipse cx="32" cy="54" rx="18" ry="3.5" fill="#1E40AF" opacity="0.14" />
        {/* Tail Fin */}
        <path d="M12 24C15 29 18 31 20 32C18 33 15 35 12 40C16 37 19 36 22 34L20 32L22 30C19 28 16 27 12 24Z" fill={`url(#${id}-fin)`} />
        {/* Dorsal Fin */}
        <path d="M28 22C32 16 38 16 42 20C38 21 33 22 28 22Z" fill={`url(#${id}-fin)`} />
        {/* Fish Main Body */}
        <path d="M18 32C22 25 32 21 44 24C49 26 53 29 54 32C53 35 49 38 44 40C32 43 22 39 18 32Z" fill={`url(#${id}-fish)`} />
        {/* Fish Lighter Belly */}
        <path d="M22 33C26 38 36 41 46 38C44 39 41 40 38 40C28 41 24 37 22 33Z" fill={`url(#${id}-belly)`} />
        {/* Fish Scales details */}
        <path d="M30 28C32 30 32 34 30 36M35 28C37 30 37 34 35 36M40 29C42 31 42 33 40 35" stroke="#BAE6FD" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
        {/* Eye */}
        <circle cx="48" cy="30" r="2.5" fill="#FFFFFF" />
        <circle cx="48.5" cy="30" r="1.3" fill="#0F172A" />
        {/* Pectoral Fin */}
        <path d="M33 33C37 33 40 37 38 40C35 40 33 37 33 33Z" fill={`url(#${id}-fin)`} opacity="0.9" />
        {/* Bubbles */}
        <circle cx="56" cy="24" r="2" fill="#7DD3FC" opacity="0.8" />
        <circle cx="59" cy="19" r="1.3" fill="#7DD3FC" opacity="0.6" />
    </svg>
);

const BakeryBreadIcon = ({ id = "bakery" }) => (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
        <defs>
            <linearGradient id={`${id}-loaf`} x1="14" y1="22" x2="50" y2="46" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FBBF24" />
                <stop offset="0.5" stopColor="#D97706" />
                <stop offset="1" stopColor="#92400E" />
            </linearGradient>
            <linearGradient id={`${id}-croissant`} x1="20" y1="36" x2="48" y2="52" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FDE68A" />
                <stop offset="1" stopColor="#D97706" />
            </linearGradient>
        </defs>
        <ellipse cx="32" cy="54" rx="18" ry="3.5" fill="#92400E" opacity="0.14" />
        {/* Sourdough Artisan Loaf */}
        <path d="M14 36C12 28 18 20 32 20C46 20 52 28 50 36C48 43 42 45 32 45C22 45 16 43 14 36Z" fill={`url(#${id}-loaf)`} />
        {/* Scored Crust Marks */}
        <path d="M22 25C24 28 25 33 24 37" stroke="#FEF3C7" strokeWidth="2" strokeLinecap="round" />
        <path d="M31 23C33 27 33 33 32 38" stroke="#FEF3C7" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M40 25C41 28 41 33 39 37" stroke="#FEF3C7" strokeWidth="2" strokeLinecap="round" />
        {/* Golden Flour Dust Highlights */}
        <ellipse cx="32" cy="22" rx="10" ry="2" fill="#FFFBEB" opacity="0.4" />
        {/* Aroma Steam Swirls */}
        <path d="M26 14C27 11 25 9 26 7M33 15C34 12 32 10 33 8M40 14C41 11 39 9 40 7" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    </svg>
);

const WheatGrainsIcon = ({ id = "grains" }) => (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
        <defs>
            <linearGradient id={`${id}-wheat`} x1="18" y1="12" x2="46" y2="52" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FDE047" />
                <stop offset="0.6" stopColor="#EAB308" />
                <stop offset="1" stopColor="#CA8A04" />
            </linearGradient>
            <linearGradient id={`${id}-kernel`} x1="24" y1="16" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FEF08A" />
                <stop offset="1" stopColor="#CA8A04" />
            </linearGradient>
        </defs>
        <ellipse cx="32" cy="55" rx="14" ry="3" fill="#CA8A04" opacity="0.14" />
        {/* Stalk Stem */}
        <path d="M32 54C32 45 32 25 32 14" stroke="#A16207" strokeWidth="2" strokeLinecap="round" />
        {/* Wheat Kernels Left */}
        <path d="M32 20C26 18 24 22 28 25C31 26 32 24 32 20Z" fill={`url(#${id}-kernel)`} stroke="#A16207" strokeWidth="0.8" />
        <path d="M32 27C26 25 24 29 28 32C31 33 32 31 32 27Z" fill={`url(#${id}-kernel)`} stroke="#A16207" strokeWidth="0.8" />
        <path d="M32 34C26 32 24 36 28 39C31 40 32 38 32 34Z" fill={`url(#${id}-kernel)`} stroke="#A16207" strokeWidth="0.8" />
        {/* Wheat Kernels Right */}
        <path d="M32 17C38 15 40 19 36 22C33 23 32 21 32 17Z" fill={`url(#${id}-kernel)`} stroke="#A16207" strokeWidth="0.8" />
        <path d="M32 24C38 22 40 26 36 29C33 30 32 28 32 24Z" fill={`url(#${id}-kernel)`} stroke="#A16207" strokeWidth="0.8" />
        <path d="M32 31C38 29 40 33 36 36C33 37 32 35 32 31Z" fill={`url(#${id}-kernel)`} stroke="#A16207" strokeWidth="0.8" />
        {/* Top Whisker Awns */}
        <path d="M32 15L32 8M32 16L24 9M32 16L40 9M28 20L20 16M36 17L44 13" stroke="#CA8A04" strokeWidth="1.4" strokeLinecap="round" opacity="0.8" />
    </svg>
);

const OilJarIcon = ({ id = "cooking" }) => (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
        <defs>
            <linearGradient id={`${id}-glass`} x1="18" y1="16" x2="46" y2="52" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FEF3C7" stopOpacity="0.8" />
                <stop offset="1" stopColor="#FDE68A" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id={`${id}-oil`} x1="22" y1="28" x2="42" y2="52" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FBBF24" />
                <stop offset="0.6" stopColor="#F59E0B" />
                <stop offset="1" stopColor="#D97706" />
            </linearGradient>
            <linearGradient id={`${id}-cork`} x1="28" y1="10" x2="36" y2="16" gradientUnits="userSpaceOnUse">
                <stop stopColor="#B45309" />
                <stop offset="1" stopColor="#78350F" />
            </linearGradient>
        </defs>
        <ellipse cx="32" cy="54" rx="14" ry="3.5" fill="#D97706" opacity="0.14" />
        {/* Glass Flask Jar Body */}
        <path d="M28 16H36V22L44 32C47 36 46 48 42 52C38 54 26 54 22 52C18 48 17 36 20 32L28 22V16Z" fill={`url(#${id}-glass)`} stroke="#F59E0B" strokeWidth="1.5" />
        {/* Golden Cooking Oil Level */}
        <path d="M21 34C24 33 28 35 32 34C36 33 40 35 43 34C45 38 45 46 41 50C38 52 26 52 23 50C19 46 19 38 21 34Z" fill={`url(#${id}-oil)`} />
        {/* Cork Stopper with Pour Spout */}
        <rect x="28" y="10" width="8" height="6" rx="1.5" fill={`url(#${id}-cork)`} />
        <path d="M30 10V6L34 8" stroke="#78350F" strokeWidth="1.5" strokeLinecap="round" />
        {/* Olive Sprig Detail on Jar */}
        <circle cx="32" cy="42" r="3" fill="#65A30D" />
        <path d="M32 39C34 37 36 38 37 40" stroke="#4D7C0F" strokeWidth="1.2" strokeLinecap="round" />
        {/* Glass Sheen */}
        <path d="M23 32L27 24" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
    </svg>
);

const ChilledDrinkIcon = ({ id = "drinks" }) => (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
        <defs>
            <linearGradient id={`${id}-cup`} x1="20" y1="18" x2="44" y2="52" gradientUnits="userSpaceOnUse">
                <stop stopColor="#2DD4BF" />
                <stop offset="0.6" stopColor="#0D9488" />
                <stop offset="1" stopColor="#115E59" />
            </linearGradient>
            <linearGradient id={`${id}-straw`} x1="34" y1="6" x2="46" y2="30" gradientUnits="userSpaceOnUse">
                <stop stopColor="#F43F5E" />
                <stop offset="1" stopColor="#BE123C" />
            </linearGradient>
        </defs>
        <ellipse cx="32" cy="54" rx="13" ry="3" fill="#0D9488" opacity="0.14" />
        {/* Striped Straw */}
        <path d="M33 24L42 6H46L36 24" fill={`url(#${id}-straw)`} />
        <path d="M37 16L40 18M40 10L43 12" stroke="#FFFFFF" strokeWidth="1.5" />
        {/* Cup Body */}
        <path d="M21 22H43L40 50C39.5 52 37 53 35 53H29C27 53 24.5 52 24 50L21 22Z" fill={`url(#${id}-cup)`} />
        {/* Translucent Cup Lid */}
        <ellipse cx="32" cy="22" rx="12" ry="3.5" fill="#CCFBF1" stroke="#14B8A6" strokeWidth="1.2" />
        {/* Ice Cubes inside */}
        <rect x="26" y="28" width="6" height="6" rx="1.5" fill="#F0FDFA" opacity="0.8" transform="rotate(12 26 28)" />
        <rect x="32" y="34" width="6" height="6" rx="1.5" fill="#F0FDFA" opacity="0.8" transform="rotate(-8 32 34)" />
        {/* Citrus Lemon Wheel Garnish */}
        <circle cx="21" cy="22" r="6" fill="#FBBF24" stroke="#F59E0B" strokeWidth="1.2" />
        <circle cx="21" cy="22" r="4" fill="#FEF3C7" />
        {/* Fresh bubbles */}
        <circle cx="29" cy="44" r="1.5" fill="#99F6E4" />
        <circle cx="34" cy="47" r="1.2" fill="#99F6E4" />
    </svg>
);

const NoodleBowlIcon = ({ id = "instant" }) => (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
        <defs>
            <linearGradient id={`${id}-bowl`} x1="16" y1="28" x2="48" y2="52" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FB923C" />
                <stop offset="0.6" stopColor="#EA580C" />
                <stop offset="1" stopColor="#C2410C" />
            </linearGradient>
            <linearGradient id={`${id}-noodles`} x1="22" y1="20" x2="42" y2="34" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FEF08A" />
                <stop offset="1" stopColor="#F59E0B" />
            </linearGradient>
        </defs>
        <ellipse cx="32" cy="54" rx="16" ry="3.5" fill="#C2410C" opacity="0.14" />
        {/* Bowl Rim & Body */}
        <path d="M16 32C16 44 23 51 32 51C41 51 48 44 48 32H16Z" fill={`url(#${id}-bowl)`} />
        <ellipse cx="32" cy="32" rx="16" ry="4.5" fill="#9A3412" />
        {/* Steaming Noodles Heap */}
        <ellipse cx="32" cy="31" rx="14" ry="4" fill={`url(#${id}-noodles)`} />
        <path d="M22 30C25 28 28 32 32 30C36 28 39 32 42 30" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M24 32C27 30 30 34 34 32C37 30 40 33 42 32" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" />
        {/* Lifted Noodles by Chopsticks */}
        <path d="M34 29C33 22 35 18 36 15" stroke="#FDE047" strokeWidth="2" strokeLinecap="round" />
        <path d="M22 14L46 16M24 11L48 15" stroke="#78350F" strokeWidth="2" strokeLinecap="round" />
        {/* Scallion Green Garnish */}
        <rect x="28" y="29" width="3" height="2" rx="0.5" fill="#22C55E" />
        <rect x="35" y="30" width="3" height="2" rx="0.5" fill="#22C55E" />
        {/* Steam */}
        <path d="M26 22C25 18 27 16 26 13M38 22C39 18 37 16 38 13" stroke="#FDBA74" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
    </svg>
);

const SnowflakeFrozenIcon = ({ id = "frozen" }) => (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
        <defs>
            <linearGradient id={`${id}-snow`} x1="14" y1="14" x2="50" y2="50" gradientUnits="userSpaceOnUse">
                <stop stopColor="#38BDF8" />
                <stop offset="0.5" stopColor="#0284C7" />
                <stop offset="1" stopColor="#0369A1" />
            </linearGradient>
            <linearGradient id={`${id}-glow`} x1="20" y1="20" x2="44" y2="44" gradientUnits="userSpaceOnUse">
                <stop stopColor="#E0F2FE" />
                <stop offset="1" stopColor="#BAE6FD" />
            </linearGradient>
        </defs>
        <ellipse cx="32" cy="54" rx="14" ry="3.5" fill="#0284C7" opacity="0.14" />
        {/* Soft Frost Aura */}
        <circle cx="32" cy="32" r="16" fill={`url(#${id}-glow)`} opacity="0.5" />
        {/* Main 6-Axis Faceted Snowflake */}
        {/* Vertical Axis */}
        <path d="M32 10V54M32 16L27 21M32 16L37 21M32 48L27 43M32 48L37 43" stroke={`url(#${id}-snow)`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {/* Diagonal 1 (60 deg) */}
        <path d="M13 21L51 43M18 24L17 31M18 24L24 23M46 40L47 33M46 40L40 41" stroke={`url(#${id}-snow)`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {/* Diagonal 2 (120 deg) */}
        <path d="M13 43L51 21M18 40L24 41M18 40L17 33M46 24L40 23M46 24L47 31" stroke={`url(#${id}-snow)`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {/* Central Core Crystal */}
        <circle cx="32" cy="32" r="4.5" fill="#FFFFFF" stroke="#0284C7" strokeWidth="2" />
        {/* Sparkle Crystals */}
        <circle cx="16" cy="14" r="1.5" fill="#38BDF8" />
        <circle cx="48" cy="14" r="2" fill="#38BDF8" />
    </svg>
);

const CleaningSprayIcon = ({ id = "household" }) => (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
        <defs>
            <linearGradient id={`${id}-bottle`} x1="22" y1="24" x2="44" y2="52" gradientUnits="userSpaceOnUse">
                <stop stopColor="#A78BFA" />
                <stop offset="0.6" stopColor="#7C3AED" />
                <stop offset="1" stopColor="#5B21B6" />
            </linearGradient>
            <linearGradient id={`${id}-head`} x1="20" y1="12" x2="38" y2="24" gradientUnits="userSpaceOnUse">
                <stop stopColor="#2DD4BF" />
                <stop offset="1" stopColor="#0D9488" />
            </linearGradient>
        </defs>
        <ellipse cx="32" cy="54" rx="13" ry="3.5" fill="#5B21B6" opacity="0.14" />
        {/* Trigger Spray Head */}
        <path d="M26 14H36L38 18L33 22H27L24 17L26 14Z" fill={`url(#${id}-head)`} />
        {/* Spray Nozzle */}
        <rect x="36" y="15" width="6" height="4" rx="1" fill="#14B8A6" />
        {/* Trigger Handle */}
        <path d="M33 22C36 24 37 28 35 30" stroke="#0D9488" strokeWidth="2" strokeLinecap="round" />
        {/* Bottle Body */}
        <path d="M26 22H34L38 30L40 48C40 51 38 53 35 53H27C24 53 22 51 22 48L24 30L26 22Z" fill={`url(#${id}-bottle)`} />
        {/* Liquid Wave Line */}
        <path d="M23 37C26 36 29 38 33 37C36 36 38 37 39 37" stroke="#C4B5FD" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        {/* Sparkle Clean Stars */}
        <path d="M48 14L49.5 17.5L53 19L49.5 20.5L48 24L46.5 20.5L43 19L46.5 17.5L48 14Z" fill="#FBBF24" />
        <circle cx="45" cy="11" r="1.5" fill="#38BDF8" />
    </svg>
);

const PersonalCareIcon = ({ id = "personal" }) => (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
        <defs>
            <linearGradient id={`${id}-dispenser`} x1="22" y1="20" x2="44" y2="52" gradientUnits="userSpaceOnUse">
                <stop stopColor="#F472B6" />
                <stop offset="0.6" stopColor="#DB2777" />
                <stop offset="1" stopColor="#9D174D" />
            </linearGradient>
            <linearGradient id={`${id}-pump`} x1="28" y1="10" x2="38" y2="20" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FBBF24" />
                <stop offset="1" stopColor="#D97706" />
            </linearGradient>
        </defs>
        <ellipse cx="32" cy="54" rx="14" ry="3.5" fill="#9D174D" opacity="0.14" />
        {/* Lotion Pump Top */}
        <rect x="29" y="16" width="6" height="6" fill="#D97706" />
        <path d="M27 16H37C39 16 41 14 41 12H30C28 12 27 14 27 16Z" fill={`url(#${id}-pump)`} />
        <path d="M27 15L24 17" stroke="#B45309" strokeWidth="1.8" strokeLinecap="round" />
        {/* Luxury Rounded Bottle */}
        <path d="M24 22H40C43 22 44 26 44 30L43 48C43 51 40 53 37 53H27C24 53 21 51 21 48L20 30C20 26 21 22 24 22Z" fill={`url(#${id}-dispenser)`} />
        {/* Botanical Leaf Label Motif */}
        <circle cx="32" cy="38" r="7" fill="#FCE7F3" opacity="0.4" />
        <path d="M30 42C30 36 34 34 36 34C36 38 34 42 30 42Z" fill="#FDF2F8" />
        <path d="M30 42C32 39 34 37 36 35" stroke="#DB2777" strokeWidth="1" strokeLinecap="round" />
    </svg>
);

const BabyBottleIcon = ({ id = "baby" }) => (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
        <defs>
            <linearGradient id={`${id}-bottle`} x1="22" y1="22" x2="42" y2="52" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FBCFE8" />
                <stop offset="0.6" stopColor="#F472B6" />
                <stop offset="1" stopColor="#DB2777" />
            </linearGradient>
            <linearGradient id={`${id}-teat`} x1="28" y1="8" x2="36" y2="16" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FDE68A" />
                <stop offset="1" stopColor="#F59E0B" />
            </linearGradient>
        </defs>
        <ellipse cx="32" cy="54" rx="13" ry="3.5" fill="#DB2777" opacity="0.14" />
        {/* Soft Silicone Nipple / Teat */}
        <path d="M30 14C30 11 31 8 32 8C33 8 34 11 34 14H30Z" fill={`url(#${id}-teat)`} />
        {/* Collar Ring */}
        <rect x="26" y="14" width="12" height="6" rx="2" fill="#38BDF8" />
        {/* Bottle Body */}
        <rect x="23" y="20" width="18" height="31" rx="4" fill={`url(#${id}-bottle)`} />
        {/* Milk Level */}
        <path d="M24 30C26 29 29 31 32 30C35 29 38 31 40 30V48C40 49.5 38.5 51 37 51H27C25.5 51 24 49.5 24 48V30Z" fill="#FFF1F2" />
        {/* Measurement Marks */}
        <path d="M26 34H30M26 38H32M26 42H30M26 46H32" stroke="#F43F5E" strokeWidth="1.5" strokeLinecap="round" />
        {/* Gentle Star Accent */}
        <path d="M48 20L49 22L51 23L49 24L48 26L47 24L45 23L47 22L48 20Z" fill="#FBBF24" />
    </svg>
);

const EggsIllustrationIcon = ({ id = "eggs" }) => (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
        <defs>
            <linearGradient id={`${id}-egg1`} x1="20" y1="20" x2="38" y2="46" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FEF3C7" />
                <stop offset="0.6" stopColor="#FDE68A" />
                <stop offset="1" stopColor="#F59E0B" />
            </linearGradient>
            <linearGradient id={`${id}-egg2`} x1="32" y1="22" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FFFFFF" />
                <stop offset="0.6" stopColor="#F1F5F9" />
                <stop offset="1" stopColor="#CBD5E1" />
            </linearGradient>
            <linearGradient id={`${id}-nest`} x1="16" y1="40" x2="48" y2="52" gradientUnits="userSpaceOnUse">
                <stop stopColor="#D97706" />
                <stop offset="1" stopColor="#78350F" />
            </linearGradient>
        </defs>
        <ellipse cx="32" cy="54" rx="16" ry="3.5" fill="#78350F" opacity="0.14" />
        {/* Brown Farm Egg Left */}
        <path d="M28 22C21 22 18 31 20 40C22 47 32 48 35 42C38 34 34 22 28 22Z" fill={`url(#${id}-egg1)`} />
        {/* White Layer Egg Right */}
        <path d="M38 24C33 24 30 32 32 40C34 47 43 47 45 42C48 34 44 24 38 24Z" fill={`url(#${id}-egg2)`} />
        {/* Straw Nest Cushion */}
        <path d="M16 46C22 52 42 52 48 46C44 50 38 52 32 52C26 52 20 50 16 46Z" fill={`url(#${id}-nest)`} />
        <path d="M14 44C20 49 26 47 32 49C38 47 44 49 50 44" stroke="#B45309" strokeWidth="2" strokeLinecap="round" />
        {/* Natural Feather Accent */}
        <path d="M42 30C46 26 49 25 51 24C50 27 48 30 45 33" stroke="#A16207" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
);

const DefaultGroceryIcon = ({ id = "default" }) => (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
        <defs>
            <linearGradient id={`${id}-bag`} x1="18" y1="22" x2="46" y2="52" gradientUnits="userSpaceOnUse">
                <stop stopColor="#34D399" />
                <stop offset="0.6" stopColor="#10B981" />
                <stop offset="1" stopColor="#047857" />
            </linearGradient>
        </defs>
        <ellipse cx="32" cy="54" rx="15" ry="3.5" fill="#047857" opacity="0.14" />
        {/* Bag Handles */}
        <path d="M26 24V16C26 13 29 11 32 11C35 11 38 13 38 16V24" stroke="#065F46" strokeWidth="2.5" strokeLinecap="round" />
        {/* Reusable Grocery Tote */}
        <rect x="18" y="22" width="28" height="29" rx="4" fill={`url(#${id}-bag)`} />
        {/* Produce Peeking Out */}
        <circle cx="27" cy="20" r="5" fill="#EF4444" />
        <path d="M37 17C40 14 43 16 44 19C41 20 38 19 37 17Z" fill="#F59E0B" />
        <path d="M34 14C35 17 33 19 31 21" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" />
        {/* GreenCart Star Motif */}
        <circle cx="32" cy="36" r="6" fill="#A7F3D0" opacity="0.4" />
        <path d="M32 32L33.5 34.5L36 36L33.5 37.5L32 40L30.5 37.5L28 36L30.5 34.5L32 32Z" fill="#ECFDF5" />
    </svg>
);

/**
 * CategoryIcon Component
 * Renders the custom SVG illustration with a soft circular gradient background.
 */
const CategoryIcon = ({ category = "", className = "", size = "md" }) => {
    const meta = resolveCategoryMeta(category);
    const key = meta.iconKey || "default";

    // Responsive size mappings: Desktop: 76-90px SVG, Tablet: 68-80px SVG, Mobile: 60-72px SVG
    const sizeClasses = {
        sm: "w-12 h-12 p-2",
        md: "w-[76px] h-[76px] sm:w-[86px] sm:h-[86px] md:w-[92px] md:h-[92px] lg:w-[104px] lg:h-[104px] p-2 sm:p-2.5 lg:p-3",
        lg: "w-28 h-28 sm:w-32 sm:h-32 p-3 sm:p-4",
    }[size] || "w-[76px] h-[76px] sm:w-[86px] sm:h-[86px] md:w-[92px] md:h-[92px] lg:w-[104px] lg:h-[104px] p-2 sm:p-2.5 lg:p-3";

    const renderIcon = () => {
        switch (key) {
            case "vegetables":
                return <BroccoliLeafIcon id={`cat-${key}`} />;
            case "fruits":
                return <FruitOrangeAppleIcon id={`cat-${key}`} />;
            case "dairy":
                return <MilkBottleIcon id={`cat-${key}`} />;
            case "meat-fish":
                return <FishIllustrationIcon id={`cat-${key}`} />;
            case "bakery":
                return <BakeryBreadIcon id={`cat-${key}`} />;
            case "grains":
                return <WheatGrainsIcon id={`cat-${key}`} />;
            case "cooking":
                return <OilJarIcon id={`cat-${key}`} />;
            case "drinks":
                return <ChilledDrinkIcon id={`cat-${key}`} />;
            case "instant":
                return <NoodleBowlIcon id={`cat-${key}`} />;
            case "frozen":
                return <SnowflakeFrozenIcon id={`cat-${key}`} />;
            case "household":
                return <CleaningSprayIcon id={`cat-${key}`} />;
            case "personal":
                return <PersonalCareIcon id={`cat-${key}`} />;
            case "baby":
                return <BabyBottleIcon id={`cat-${key}`} />;
            case "eggs":
                return <EggsIllustrationIcon id={`cat-${key}`} />;
            default:
                return <DefaultGroceryIcon id={`cat-${key}`} />;
        }
    };

    return (
        <div
            className={`relative rounded-full flex items-center justify-center bg-gradient-to-tr ${meta.iconRing} shadow-inner transition-transform duration-300 group-hover:scale-110 ${sizeClasses} ${className}`}
            aria-hidden="true"
        >
            <div className="absolute inset-1 rounded-full bg-white/70 backdrop-blur-xs" />
            <div className="relative z-10 w-full h-full flex items-center justify-center">
                {renderIcon()}
            </div>
        </div>
    );
};

export default CategoryIcon;
