import React from 'react';
import DynamicHeroBanner from '../components/DynamicHeroBanner';
import FeaturedCategories from '../components/FeaturedCategories';
import FlashSale from '../components/FlashSale';
import TrendingProducts from '../components/TrendingProducts';
import BestSeller from '../components/BestSeller';
import RecentlyViewed from '../components/RecentlyViewed';
import BottomBanner from '../components/BottomBanner';
import NewsLetter from '../components/NewsLetter';
import CouponPopup from '../components/CouponPopup';

export const Home = () => {
    return (
        <div className='mt-6 md:mt-8 space-y-4 md:space-y-6'>
            <CouponPopup />

            {/* 1. Dynamic Hero Banner with Multiple Sliding Banners */}
            <DynamicHeroBanner />

            {/* 2. Featured Categories with Dynamic Counts & Clean Navigation */}
            <FeaturedCategories />

            {/* 3. Limited-Time Flash Sale with Real Countdown & Discount Percentage */}
            <FlashSale />

            {/* 4. Trending Products Based on High Ratings & Customer Reviews */}
            <TrendingProducts />

            {/* 5. Best Sellers Aggregated from Verified Order Sales Data */}
            <BestSeller />

            {/* 6. Recently Viewed Products Tracked in localStorage (Guest & User) */}
            <RecentlyViewed />

            {/* Preserved Secondary Promotional Banner & Newsletter */}
            <BottomBanner />
            <NewsLetter />
        </div>
    );
};

export default Home;
