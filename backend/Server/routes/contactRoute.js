/**
 * file name: contactRoute.js
 * name: Berny Perez
 * description:
 * - Defines all contact routes for /api/contacts.
 * - All routes are protected and require verifyToken middleware.
 */

import { Router } from "express";
import { searchContact, getAllContacts, getContactsForList, deleteDm } from "../controllers/contactcontrol.js";
import { verifyToken } from "../middleware/verifyToken.js";

const contactRouter = Router();

contactRouter.post("/search", verifyToken, searchContact);
contactRouter.get("/all-contacts", verifyToken, getAllContacts);
contactRouter.get("/get-contacts-for-list", verifyToken, getContactsForList);
contactRouter.delete("/delete-dm/:dmId", verifyToken, deleteDm);

export default contactRouter;
