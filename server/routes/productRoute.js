import express from 'express';
import { upload } from '../configs/multer.js';
import authSeller from '../middlewares/authSeller.js';
import { requireRole } from '../middlewares/authRole.js';
import {
    addProduct,
    changeStock,
    deleteProduct,
    getBestSellers,
    getTrendingProducts,
    productById,
    productList,
    sellerProductById,
    sellerProductList,
    updateProduct
} from '../controllers/productController.js';

const productRouter = express.Router();

// Product mutations restricted to Admin and CTO
productRouter.post('/add', authSeller, requireRole('Admin', 'CTO'), upload.array('images', 4), addProduct);
productRouter.get('/seller/list', authSeller, sellerProductList);
productRouter.get('/seller/:id', authSeller, sellerProductById);
productRouter.get('/list', productList);
productRouter.get('/bestsellers', getBestSellers);
productRouter.get('/trending', getTrendingProducts);
productRouter.get('/id/:id', productById);
productRouter.post('/stock', authSeller, requireRole('Admin', 'CTO'), changeStock);
productRouter.post('/update', authSeller, requireRole('Admin', 'CTO'), upload.array('images', 4), updateProduct);
productRouter.post('/update/:id', authSeller, requireRole('Admin', 'CTO'), upload.array('images', 4), updateProduct);
productRouter.post('/delete', authSeller, requireRole('Admin', 'CTO'), deleteProduct);
productRouter.delete('/delete/:id', authSeller, requireRole('Admin', 'CTO'), deleteProduct);

export default productRouter;
