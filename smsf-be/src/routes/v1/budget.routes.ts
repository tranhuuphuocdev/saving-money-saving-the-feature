import express from "express";
import {
	getBudgetJars,
	getBudgetJarSuggestions,
	getSavingGoal,
	setupBudgetJars,
	upsertSavingGoal,
} from "../../controllers/budget.controller";

const router = express.Router();

router.get("/saving-goal", getSavingGoal);
router.put("/saving-goal", upsertSavingGoal);
router.get("/jars", getBudgetJars);
router.get("/jar-suggestions", getBudgetJarSuggestions);
router.put("/jars/setup", setupBudgetJars);

export default router;