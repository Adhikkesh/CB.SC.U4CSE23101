import express from "express"
import { createController, readController } from "./controller.js";
import middleware from "./middlewae.js";

const CommonRouter = express.Router();

CommonRouter.post("/create",createController);
CommonRouter.get("/read/:id",readController);

export default CommonRouter;