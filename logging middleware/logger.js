const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const VALID_STACKS = ["backend", "frontend"];
const VALID_LEVELS = ["debug", "info", "warn", "error", "fatal"];

const VALID_BACKEND_PACKAGES = [
    "cache", "controller", "cron_job", "db", "domain",
    "handler", "repository", "route", "service",
    "auth", "config", "middleware", "utils"
];

const VALID_FRONTEND_PACKAGES = [
    "api", "component", "hook", "page", "state", "style",
    "auth", "config", "middleware", "utils"
];

const LOG_API_URL = "http://20.207.122.201/evaluation-service/logs";

function getToken() {

    if (process.env.LOG_AUTH_TOKEN) return process.env.LOG_AUTH_TOKEN;

    try {
        const tokenPath = path.resolve(__dirname, '..', 'token.json');
        if (fs.existsSync(tokenPath)) {
            const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
            return tokenData.access_token || "";
        }
    } catch (_err) { }

    return "";
}

async function renewToken() {
    try {
        const credentialsPath = path.resolve(__dirname, '..', 'credentials.json');
        if (!fs.existsSync(credentialsPath)) {
            console.warn("no credentials.json");
            return null;
        }
        
        let credentials;
        try {
            credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
        } catch (parseErr) {
            console.warn(`file credentials.json is empty or invalid JSON.`);
            return null;
        }

        const authPayload = {
            email: credentials.email,
            name: credentials.name,
            rollNo: credentials.rollNo,
            accessCode: credentials.accessCode,
            clientID: credentials.clientID,
            clientSecret: credentials.clientSecret
        };

        const response = await fetch("http://20.207.122.201/evaluation-service/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(authPayload)
        });

        if (response.ok) {
            const authData = await response.json();
            const tokenPath = path.resolve(__dirname, '..', 'token.json');
            fs.writeFileSync(tokenPath, JSON.stringify(authData, null, 2));
            console.log("token renewed");
            return authData.access_token;
        } else {
            console.warn(`renew failed: ${response.status}`);
            return null;
        }
    } catch (err) {
        console.warn(`renew error: ${err.message}`);
        return null;
    }
}

async function Log(stack, level, pkg, message, token) {
    if (!VALID_STACKS.includes(stack)) {
        console.warn(`bad stack ${stack}`);
    }
    if (!VALID_LEVELS.includes(level)) {
        console.warn(`bad level ${level}`);
    }

    const validPackages = stack === 'frontend' ? VALID_FRONTEND_PACKAGES : VALID_BACKEND_PACKAGES;
    if (!validPackages.includes(pkg)) {
        console.warn(`bad pkg ${pkg}`);
    }

    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] [${stack}/${pkg}] ${message}`);

    const payload = {
        stack,
        level,
        package: pkg,
        message
    };

    let bearerToken = getToken(token);

    const headers = { "Content-Type": "application/json" };
    if (bearerToken) {
        headers["Authorization"] = `Bearer ${bearerToken}`;
    }

    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const response = await fetch(LOG_API_URL, {
                method: "POST",
                headers,
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const data = await response.json();
                return data;
            }

            if (response.status === 401 && attempt === 1) {
                console.warn("got 401, renewing...");
                const newToken = await renewToken();
                if (newToken) {
                    headers["Authorization"] = `Bearer ${newToken}`;
                    continue;
                }
            }
            
            const errText = await response.text();
            console.error(`log rejected ${response.status}`);
            break;
        } catch (networkErr) {
            console.error(`net error ${networkErr.message}`);
            break;
        }
    }

    return null;
}

function requestLogger(stack) {
    return (req, res, next) => {
        const startTime = Date.now();

        res.on('finish', () => {
            const duration = Date.now() - startTime;
            const statusCode = res.statusCode;
            const level = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";

            Log(
                stack,
                level,
                "middleware",
                `${req.method} ${req.originalUrl} ${statusCode} ${duration}ms`
            );
        });

        next();
    };
}


module.exports = {
    Log,
    requestLogger,
    getToken,
    renewToken,
    VALID_STACKS,
    VALID_LEVELS,
    VALID_BACKEND_PACKAGES,
    VALID_FRONTEND_PACKAGES
};
