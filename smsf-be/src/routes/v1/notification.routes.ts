import express from "express";
import {
    createNotification,
    deleteNotification,
    listNotifications,
    payNotification,
    updateNotification,
} from "../../controllers/notification.controller";

const router = express.Router();

router.get("/", listNotifications);
router.post("/", createNotification);
router.post("/:notificationId/pay", payNotification);
router.patch("/:notificationId", updateNotification);
router.delete("/:notificationId", deleteNotification);

export default router;
