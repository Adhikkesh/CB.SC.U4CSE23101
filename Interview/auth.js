import express from "express"
import { loginController, registerController } from "./controller.js";

const authRouter = express.Router();

authRouter.post("/login",loginController);
authRouter.post("/register",registerController);
export default authRouter;