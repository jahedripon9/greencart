import { assets } from "../assets/assets";
import { useAppContext } from "../context/AppContext";
import StarRating from "./StarRating";

const ProductCard = ({ product }) => {

    const { currency, addToCart, removeFromCart, cartItems, navigate } = useAppContext();

    const safeRating = Number(product?.averageRating) || 0;
    const safeReviewCount = Number(product?.reviewCount) || 0;
    const categoryPath = (product?.category || 'item').toLowerCase();

    const isOutOfStock = product?.stockQuantity === 0 || product?.inStock === false;
    const isRecordedStock = product?.stockQuantity !== null && product?.stockQuantity !== undefined;
    const threshold = (typeof product?.lowStockThreshold === 'number' && product.lowStockThreshold >= 1)
        ? product.lowStockThreshold
        : 5;
    const isLowStock = isRecordedStock && product.stockQuantity > 0 && product.stockQuantity <= threshold;
    const currentInCart = cartItems[product?._id] || 0;

    let regularPrice = typeof product?.price === 'number' && Number.isFinite(product.price) && product.price > 0 ? product.price : null;
    if (regularPrice === null && typeof product?.offerPrice === 'number' && Number.isFinite(product.offerPrice) && product.offerPrice > 0) {
        regularPrice = product.offerPrice;
    }
    const hasValidDiscount = typeof product?.offerPrice === 'number' && Number.isFinite(product.offerPrice) && product.offerPrice > 0 && regularPrice !== null && product.offerPrice < regularPrice;
    const effectivePrice = hasValidDiscount ? product.offerPrice : (regularPrice || 0);

    return product && (
        <div onClick={() => { navigate(`/products/${categoryPath}/${product._id}`); scrollTo(0, 0); }} className="border border-gray-500/20 rounded-md md:px-4 px-3 py-2 bg-white min-w-56 max-w-56 w-full cursor-pointer" >
            <div className="group flex items-center justify-center px-2">
                <img className="group-hover:scale-105 transition max-w-26 md:max-w-36" src={product.image?.[0]} alt={product.name} />
            </div>
            <div className="text-gray-500/60 text-sm">
                <div className="flex items-center justify-between">
                    <p>{product.category}</p>
                    {isOutOfStock ? (
                        <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                            Out of Stock
                        </span>
                    ) : isLowStock ? (
                        <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                            Low Stock
                        </span>
                    ) : null}
                </div>
                <p className="text-gray-700 font-medium text-lg truncate w-full">{product.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                    <StarRating rating={safeRating} size="sm" />
                    <span className="text-xs text-gray-500 font-medium">
                        ({safeReviewCount})
                    </span>
                </div>
                <div className="flex items-end justify-between mt-3">
                    <p className="md:text-xl text-base font-medium text-primary">
                        {currency}{effectivePrice}{" "}
                        {hasValidDiscount && (
                            <span className="text-gray-500/60 md:text-sm text-xs line-through">
                                {currency}{regularPrice}
                            </span>
                        )}
                    </p>
                    <div onClick={(e) => { e.stopPropagation(); }} className="text-primary">
                        {isOutOfStock ? (
                            <button
                                disabled
                                aria-disabled="true"
                                className="flex items-center justify-center text-xs font-medium bg-gray-100 text-gray-400 border border-gray-200 md:w-[84px] w-[68px] h-[34px] rounded cursor-not-allowed select-none"
                                title="Out of Stock"
                            >
                                Out of Stock
                            </button>
                        ) : !currentInCart ? (
                            <button
                                className="flex items-center justify-center gap-1 bg-primary/10 border border-primary/40 md:w-[80px] w-[64px] h-[34px] rounded cursor-pointer hover:bg-primary/20 transition"
                                onClick={() => { addToCart(product._id); }}
                            >
                                <img src={assets.cart_icon} alt="cart icon" />
                                Add
                            </button>
                        ) : (
                            <div className="flex items-center justify-center gap-2 md:w-20 w-16 h-[34px] bg-primary/25 rounded select-none">
                                <button onClick={() => { removeFromCart(product._id); }} className="cursor-pointer text-md px-2 h-full">
                                    -
                                </button>
                                <span className="w-5 text-center text-xs md:text-sm font-medium">{currentInCart}</span>
                                <button
                                    onClick={() => { addToCart(product._id); }}
                                    disabled={isRecordedStock && currentInCart >= product.stockQuantity}
                                    className="cursor-pointer text-md px-2 h-full disabled:opacity-30 disabled:cursor-not-allowed"
                                    title={isRecordedStock && currentInCart >= product.stockQuantity ? `Only ${product.stockQuantity} available` : "Add more"}
                                >
                                    +
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div >
    );
};

export default ProductCard;
