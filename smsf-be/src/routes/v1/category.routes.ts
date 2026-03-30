import express from "express";
import { createCategory, getCategories, reorderCategories } from "../../controllers/category.controller";

const router = express.Router();

router.get("/", getCategories);
router.post("/", createCategory);
router.put("/order", reorderCategories);

export default router;
