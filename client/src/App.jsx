import React, { useState, useEffect, useRef } from 'react'
import Navbar from './components/Navbar'
import { Home } from './pages/Home'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Toaster, toast } from 'react-hot-toast'
import Footer from './components/Footer'
import { useAppContext } from './context/AppContext'
import Login from './components/Login'
import AllProducts from './pages/AllProducts'
import ProductCategory from './pages/ProductCategory'
import ProductDetails from './pages/ProductDetails'
import Cart from './pages/Cart'
import AddAddress from './pages/AddAddress'
import MyOrders from './pages/MyOrders'
import Invoice from './pages/Invoice'
import Messages from './pages/Messages'
import SellerLogin from './components/seller/SellerLogin'
import SellerLayout from './pages/seller/SellerLayout'
import Dashboard from './pages/seller/Dashboard'
import AddProduct from './pages/seller/AddProduct'
import ProductList from './pages/seller/ProductList'
import Orders from './pages/seller/Orders'
import SellerMessages from './pages/seller/Messages'
import SellerReviews from './pages/seller/Reviews'
import TeamManagement from './pages/seller/TeamManagement'
import ContactManagement from './pages/seller/ContactManagement'
import Notifications from './pages/seller/Notifications'
import Coupons from './pages/seller/Coupons'
import ActivityLogs from './pages/seller/ActivityLogs'
import Returns from './pages/seller/Returns'
import ReturnRefundPolicyPage from './pages/ReturnRefundPolicyPage'
import DeliveryInformation from './pages/DeliveryInformation'
import PaymentMethods from './pages/PaymentMethods'
import TrackOrder from './pages/TrackOrder'
import ContactUs from './pages/ContactUs'
import CustomerSupport from './pages/CustomerSupport'
import BestSellersPage from './pages/BestSellersPage'
import OffersDealsPage from './pages/OffersDealsPage'
import FAQsPage from './pages/FAQsPage'
import StoreContentManagement from './pages/seller/StoreContentManagement'
import { useAuth, AuthenticateWithRedirectCallback } from '@clerk/clerk-react'

const App = () => {
  const isSellerPath = useLocation().pathname.includes('seller')

  const { isLoaded: isClerkLoaded, isSignedIn, getToken, signOut } = useAuth()
  const { user, setUser, fetchUser, showUserLogin, setShowUserLogin, isSeller, axios } = useAppContext()
  const [linkingData, setLinkingData] = useState(null)
  const isExchangingRef = useRef(false)
  const hasExchangedRef = useRef(false)

  // ---------------------------------------------------------------------------
  // Clerk Google OAuth Token Exchange Bridge
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isSignedIn) {
      hasExchangedRef.current = false
      return
    }

    // If Clerk is not loaded yet, or GreenCart user is already set, or exchange in-flight/done
    if (!isClerkLoaded || user || isExchangingRef.current || hasExchangedRef.current) {
      return
    }

    const exchangeClerkToken = async () => {
      isExchangingRef.current = true
      hasExchangedRef.current = true
      try {
        const token = await getToken()
        if (!token) {
          throw new Error("Unable to retrieve Clerk session token")
        }

        const { data } = await axios.post('/api/user/clerk/google', { clerkToken: token })

        if (data.success) {
          setUser(data.user)
          if (typeof fetchUser === 'function') {
            await fetchUser()
          }
          setLinkingData(null)
          setShowUserLogin(false)
          toast.success(data.message || "Signed in with Google successfully")
        } else if (data.requirePasswordLink) {
          // Option B Account Linking Challenge
          setLinkingData({ email: data.email })
          setShowUserLogin(true)
        } else {
          toast.error(data.message || "Google authentication failed")
          await signOut()
          setLinkingData(null)
        }
      } catch (err) {
        const errorMsg = err?.response?.data?.message || err.message || "Failed to authenticate with Google"
        toast.error(errorMsg)
        try {
          await signOut()
        } catch {
          // Ignore signOut cleanup errors
        }
        setLinkingData(null)
      } finally {
        isExchangingRef.current = false
      }
    }

    exchangeClerkToken()
  }, [isClerkLoaded, isSignedIn, user, getToken, signOut, setUser, fetchUser, setShowUserLogin, axios])

  const handleCancelLinking = async () => {
    setLinkingData(null)
    setShowUserLogin(false)
    try {
      await signOut()
    } catch {
      // Ignore signOut cleanup errors
    }
  }

  return (
    <div className='text-default min-h-screen text-gray-700 bg-white'>
      {isSellerPath ? null : <Navbar />}
      {showUserLogin ? <Login linkingData={linkingData} onCancelLinking={handleCancelLinking} /> : null}
      <Toaster />
      <div className={isSellerPath ? "" : "px-6 md:px-16 lg:px-24 xl:px-32"}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sso-callback" element={<AuthenticateWithRedirectCallback signInForceRedirectUrl="/" signUpForceRedirectUrl="/" />} />
          <Route path="/products" element={<AllProducts />} />
          <Route path="/products/:category" element={<ProductCategory />} />
          <Route path="/products/:category/:id" element={<ProductDetails />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/add-address" element={<AddAddress />} />
          <Route path="/my-orders" element={<MyOrders />} />
          <Route path="/my-returns" element={<MyOrders defaultTab="returns" />} />
          <Route path="/delivery-information" element={<DeliveryInformation />} />
          <Route path="/return-refund-policy" element={<ReturnRefundPolicyPage />} />
          <Route path="/return-policy" element={<ReturnRefundPolicyPage />} />
          <Route path="/payment-methods" element={<PaymentMethods />} />
          <Route path="/track-order" element={<TrackOrder />} />
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/contact-support" element={<CustomerSupport />} />
          <Route path="/best-sellers" element={<BestSellersPage />} />
          <Route path="/offers-deals" element={<OffersDealsPage />} />
          <Route path="/faqs" element={<FAQsPage />} />
          <Route path="/order/invoice/:orderId" element={<Invoice />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/seller" element={isSeller ? <SellerLayout /> : <SellerLogin />}>
            <Route index element={isSeller ? <Dashboard /> : null} />
            <Route path='add-product' element={<AddProduct />} />
            <Route path='dashboard' element={<Dashboard />} />
            <Route path='product-list' element={<ProductList />} />
            <Route path='orders' element={<Orders />} />
            <Route path='returns' element={<Returns />} />
            <Route path='messages' element={<SellerMessages />} />
            <Route path='reviews' element={<SellerReviews />} />
            <Route path='contacts' element={<ContactManagement />} />
            <Route path='team' element={<TeamManagement />} />
            <Route path='notifications' element={<Notifications />} />
            <Route path='coupons' element={<Coupons />} />
            <Route path='store-content' element={<StoreContentManagement />} />
            <Route path='activity-logs' element={<ActivityLogs />} />
          </Route>
        </Routes>
      </div>
      {!isSellerPath && <Footer />}
    </div>
  )
}

export default App
