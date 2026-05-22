import express from "express";
import status from "http-status-codes";
import jwt from "jsonwebtoken";

const user = new Map();
const map = new Map();

export const createController = async (req,res) => {
    let {description,amount,category,date,userIds} =  req.body;


    if(!Array.isArray(userIds)) userIds = [userIds];
    if(date == null){
        date = new Date().toISOString();
    }

    let lenK = userIds.length;
    for(const e of userIds){
        
        const element = {
            e,
            description,
            amount : (amount/lenK),
            category,
            date
        }
        if(map.has(e)){
            let ob = map.get(e);
            ob.push(element);
        }else{
            map.set(e,new Array(element));
        }
    }
    
    res.status(status.CREATED).json({message: "Created Sucessfully"});
}


export const readController = async (req,res) => {
    const userId = req.params.id;
    console.log(userId);
    const ob = map.get(userId);
    console.log(ob);
    let value = 0;
    for(const e of ob){
        value += e.amount;
    }
    res.status(status.ACCEPTED).json({message: `User ${userId} : Value : ${value}`});
}

export const loginController = async (req,res) => {
    const {id,passwod} = req.body;

    const token = jwt.sign(id,"SECRET_KEY",{algorithm: "HS256"});
    
    res.json({message: "Login Successfull",token: token});
};

export const registerController = async (req,res) => {
    const {id,password} = req.body;

    if(user.has(id)){
        return res.status(status.BAD_REQUEST).json({message: "user id already present"});
    }

    user.set(id,req.body);
    res.status(status.CREATED).json({message: `User created successfully`});
}


