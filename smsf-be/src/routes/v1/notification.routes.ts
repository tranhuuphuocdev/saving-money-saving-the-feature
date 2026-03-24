import express from "express";
import {
    createNotification,
    deleteNotification,
    listNotifications,
    payNotification,
} from "../../controllers/notification.controller";

const router = express.Router();

router.get("/", listNotifications);
router.post("/", createNotification);
router.post("/:notificationId/pay", payNotification);
router.delete("/:notificationId", deleteNotification);

export default router;
