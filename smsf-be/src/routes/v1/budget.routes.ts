import express from "express";
import { getSavingGoal, upsertSavingGoal } from "../../controllers/budget.controller";

const router = express.Router();

router.get("/saving-goal", getSavingGoal);
router.put("/saving-goal", upsertSavingGoal);

export default router;