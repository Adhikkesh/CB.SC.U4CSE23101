import express from "express"
import jwt from "jsonwebtoken";

const middleware = (req,res,next) => {
    const token = req.headers['Authorization'];
    console.log(token);
    const payload = jwt.verify(token,"SECRET_KEY",{complete: true});

    req.user.id = payload.id;
    next();
}

export default middleware;