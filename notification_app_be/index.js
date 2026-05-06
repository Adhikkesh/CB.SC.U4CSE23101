const express = require('express');
const { Log, requestLogger, getToken, renewToken } = require('../logging middleware');

const app = express();
app.use(express.json());
app.use(requestLogger("backend"));

const API_URL = "http://20.207.122.201/evaluation-service/notifications";

function getWeight(type) {
    if (type === "Placement") return 3;
    if (type === "Result") return 2;
    if (type === "Event") return 1;
    return 0;
}

async function fetchNotifications() {
    let authToken = getToken();

    if (!authToken) {
        Log("backend", "warn", "config", "No initial token found. Attempting to auto-renew...");
        authToken = await renewToken();
    }

    if (!authToken) {
        Log("backend", "fatal", "config", "No auth token found. Cannot fetch notifications.");
        console.error("No auth token available. Please run 'node setup_auth.js' first.");
        return [];
    }

    Log("backend", "info", "service", "fetching notifications");

    try {
        const headers = {
            "Authorization": `Bearer ${authToken}`,
            "Content-Type": "application/json"
        };
        
        let response = await fetch(API_URL, { headers });

        if (response.status === 401) {
            Log("backend", "warn", "api", "Token expired. renewing token");
            authToken = await renewToken();
            if (authToken) {
                headers["Authorization"] = `Bearer ${authToken}`;
                response = await fetch(API_URL, { headers });
            }
        }

        if (!response.ok) {
            Log("backend", "error", "handler", `fetch failed: ${response.status}`);
            return [];
        }

        const data = await response.json();
        const notifications = data.notifications || data || [];
        Log("backend", "info", "service", `fetched ${notifications.length} notifications`);
        return notifications;

    } catch (err) {
        Log("backend", "error", "handler", `net error: ${err.message}`.substring(0, 48));
        return [];
    }
}

function getPriorityNotifications(notifications, topN = 10) {
    Log("backend", "debug", "service", `prioritizing top ${topN}`);

    notifications.sort((a, b) => {
        const weightA = getWeight(a.Type);
        const weightB = getWeight(b.Type);

        if (weightA !== weightB) {
            return weightB - weightA; 
        }
        const timeA = new Date(a.Timestamp).getTime();
        const timeB = new Date(b.Timestamp).getTime();
        return timeB - timeA;
    });

    return notifications.slice(0, topN);
}

app.get('/priority-inbox', async (req, res) => {
    Log("backend", "info", "service", "starting priority inbox");
    
    const notifications = await fetchNotifications();

    if (notifications.length === 0) {
        Log("backend", "warn", "service", "no notifications found");
        return res.status(404).json({ message: "No notifications available to prioritize." });
    }

    const top10 = getPriorityNotifications(notifications, 10);
    
    Log("backend", "info", "service", "prioritized top 10");


    res.json({ success: true, topNotifications: top10 });
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
