import { v2 as cloudinary } from "cloudinary";
import Product from '../models/Product.js'
// Add Product : /api/product/add
export const addProduct = async (req, res) => {
    try {
        let productData = JSON.parse(req.body.productData);

        const images = req.files

        let imagesUrl = await Promise.all(
            images.map(async (image) => {
                let result = await cloudinary.uploader.upload(item.path, { resource_type: "image" });
                return result.secure_url;
            })
        )

        await Product.create({ ...productData, images: imagesUrl });

        res.json({ succees: true, message: "Product added successfully" });

    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
}


// Get Product : /api/product/list
export const productList = async (req, res) => {

}

// Get single Product : /api/product/id
export const productById = async (req, res) => {

}

// Change Product inStock : /api/product/stock
export const changeStock = async (req, res) => {

}

