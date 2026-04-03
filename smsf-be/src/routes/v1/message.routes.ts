import express from "express";
import {
    sendMessage,
    getMessages,
    listConversations,
    createFriendRequest,
    acceptRequest,
    rejectRequest,
    listPendingRequests,
    searchFriendsHandler,
    listFriends,
} from "../../controllers/message.controller";

const router = express.Router();

// Direct Messages
router.post("/send", sendMessage);
router.get("/list-conversations", listConversations);

// Friend Requests
router.post("/friend-request/send", createFriendRequest);
router.post("/friend-request/accept", acceptRequest);
router.post("/friend-request/reject", rejectRequest);
router.get("/friend-request/pending", listPendingRequests);

// Search
router.get("/search/friends", searchFriendsHandler);

// Friends
router.get("/friends", listFriends);

// Direct messages by friend id (keep param route last to avoid shadowing static routes)
router.get("/:friendId", getMessages);

export default router;
