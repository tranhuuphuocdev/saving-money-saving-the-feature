import express from "express";
import {
    createNotification,
    listNotifications,
    payNotification,
} from "../../controllers/notification.controller";

const router = express.Router();

router.get("/", listNotifications);
router.post("/", createNotification);
router.post("/:notificationId/pay", payNotification);

export default router;
