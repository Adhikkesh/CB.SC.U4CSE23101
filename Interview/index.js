import express from "express";
import authRouter from "./auth.js";
import CommonRouter from "./route.js";
import middleware from "./middlewae.js";

const app = express()

app.use(express.json())


app.use("/api/v1/auth",authRouter);
app.use("/api/v1/common", CommonRouter);

app.listen(3000,()=>{});