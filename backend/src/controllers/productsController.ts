import { Request, RequestHandler, Response } from 'express';
import SellerProfile from '../models/SellerProfileModel.js';
import {
  createProduct,
  deleteProduct,
  getAllProducts,
  getProductById,
  updateProduct,
} from '../services/productService.js';

export const getProducts: RequestHandler = async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    const allowedSorts = ['id', 'price', 'stock', 'createdAt'] as const;

    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'createdAt';

    const order = typeof req.query.order === 'string' ? req.query.order.toUpperCase() : 'DESC';

    const cardId = req.query.cardId !== undefined ? Number(req.query.cardId) : undefined;

    const sellerProfileId =
      req.query.sellerProfileId !== undefined ? Number(req.query.sellerProfileId) : undefined;

    const condition = typeof req.query.condition === 'string' ? req.query.condition : undefined;

    const language = typeof req.query.language === 'string' ? req.query.language : undefined;

    const minPrice = req.query.minPrice !== undefined ? Number(req.query.minPrice) : undefined;

    const maxPrice = req.query.maxPrice !== undefined ? Number(req.query.maxPrice) : undefined;

    if (!Number.isInteger(page) || page < 1) {
      return res.status(400).json({
        error: 'Page must be a positive integer',
      });
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({
        error: 'Limit must be between 1 and 100',
      });
    }

    if (cardId !== undefined && (!Number.isInteger(cardId) || cardId < 1)) {
      return res.status(400).json({
        error: 'cardId must be a positive integer',
      });
    }

    if (
      sellerProfileId !== undefined &&
      (!Number.isInteger(sellerProfileId) || sellerProfileId < 1)
    ) {
      return res.status(400).json({
        error: 'sellerProfileId must be a positive integer',
      });
    }

    if (minPrice !== undefined && (!Number.isFinite(minPrice) || minPrice < 0)) {
      return res.status(400).json({
        error: 'minPrice must be a valid non-negative number',
      });
    }

    if (maxPrice !== undefined && (!Number.isFinite(maxPrice) || maxPrice < 0)) {
      return res.status(400).json({
        error: 'maxPrice must be a valid non-negative number',
      });
    }

    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      return res.status(400).json({
        error: 'minPrice cannot be greater than maxPrice',
      });
    }

    if (!allowedSorts.includes(sort as (typeof allowedSorts)[number])) {
      return res.status(400).json({
        error: 'Invalid sort field',
      });
    }

    if (order !== 'ASC' && order !== 'DESC') {
      return res.status(400).json({
        error: 'Order must be ASC or DESC',
      });
    }

    const result = await getAllProducts({
      cardId,
      sellerProfileId,
      condition,
      language,
      minPrice,
      maxPrice,
      page,
      limit,
      sort: sort as (typeof allowedSorts)[number],
      order: order as 'ASC' | 'DESC',
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getSingleProduct = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      res.status(400).json({
        error: 'Invalid product id',
      });
      return;
    }

    const product = await getProductById(id);

    if (!product) {
      res.status(404).json({
        error: 'Product not found',
      });
      return;
    }

    res.json(product);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Error retrieving product',
    });
  }
};

export const createSingleProduct = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
      });
      return;
    }

    const sellerProfile = await SellerProfile.findOne({
      where: {
        userId: req.user.id,
      },
    });

    if (!sellerProfile) {
      res.status(404).json({
        error: 'Seller profile not found',
      });
      return;
    }

    const product = await createProduct(sellerProfile.id, req.body);

    res.status(201).json(product);
  } catch (error) {
    console.error(error);

    if (error instanceof Error && error.message === 'Card not found') {
      res.status(404).json({
        error: 'Card not found',
      });
      return;
    }

    res.status(500).json({
      error: 'Error creating product',
    });
  }
};

export const updateSingleProduct = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
      });
      return;
    }

    const sellerProfile = await SellerProfile.findOne({
      where: {
        userId: req.user.id,
      },
    });

    if (!sellerProfile) {
      res.status(404).json({
        error: 'Seller profile not found',
      });
      return;
    }

    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({
        error: 'Invalid product id',
      });
      return;
    }

    const product = await updateProduct(id, sellerProfile.id, req.body);

    if (!product) {
      res.status(404).json({
        error: 'Product not found',
      });
      return;
    }

    res.json(product);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Error updating product',
    });
  }
};

export const deleteSingleProduct = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
      });
      return;
    }

    const sellerProfile = await SellerProfile.findOne({
      where: {
        userId: req.user.id,
      },
    });

    if (!sellerProfile) {
      res.status(404).json({
        error: 'Seller profile not found',
      });
      return;
    }

    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({
        error: 'Invalid product id',
      });
      return;
    }

    const deleted = await deleteProduct(id, sellerProfile.id);

    if (!deleted) {
      res.status(404).json({
        error: 'Product not found',
      });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Error deleting product',
    });
  }
};
