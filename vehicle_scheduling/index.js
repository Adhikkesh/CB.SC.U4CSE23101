const express = require('express');
const { Log, requestLogger, getToken, renewToken } = require('../logging middleware');

const app = express();
app.use(express.json());
app.use(requestLogger("backend"));

function optimizeMaintenanceSchedule(tasks, availableHours) {
    const n = tasks.length;

    const dp = Array.from({ length: n + 1 }, () => Array(availableHours + 1).fill(0));

    for (let i = 1; i <= n; i++) {
        const { duration: time, score } = tasks[i - 1];

        for (let w = 0; w <= availableHours; w++) {
            if (time <= w) {
                dp[i][w] = Math.max(dp[i - 1][w], dp[i - 1][w - time] + score);
            } else {
                dp[i][w] = dp[i - 1][w];
            }
        }
    }

    const selectedTasks = [];
    let w = availableHours;
    for (let i = n; i > 0 && w > 0; i--) {
        if (dp[i][w] !== dp[i - 1][w]) {
            selectedTasks.push(tasks[i - 1]);
            w -= tasks[i - 1].duration;
        }
    }

    return {
        maxScore: dp[n][availableHours],
        totalHoursUsed: availableHours - w,
        selectedTasks: selectedTasks.reverse() 
    };
}


app.get('/schedule', async (req, res) => {
    const BASE_URL = "http://20.207.122.201/evaluation-service";

    Log("backend", "info", "config", "Vehicle maintanance");

    let authToken = getToken();

    if (!authToken) {
        Log("backend", "warn", "config", "token missing, trying to renew");
        authToken = await renewToken();
    }

    if (!authToken) {
        Log("backend", "fatal", "config", "no token at all");
        console.error("No auth token available.");
        return res.status(401).json({ error: "No auth token available. Run setup_auth.js first." });
    }

    const headers = {
        "Authorization": `Bearer ${authToken}`,
        "Content-Type": "application/json"
    };

    try {
        Log("backend", "info", "service", "fetching depots from test server");

        let depotResponse = await fetch(`${BASE_URL}/depots`, { method: "GET", headers });

        if (depotResponse.status === 401) {
            Log("backend", "warn", "service", "token expired. trying to renew");
            authToken = await renewToken();
            if (authToken) {
                headers["Authorization"] = `Bearer ${authToken}`;
                depotResponse = await fetch(`${BASE_URL}/depots`, { method: "GET", headers });
            }
        }

        if (!depotResponse.ok) {
            Log("backend", "error", "handler", `depot fetch failed: ${depotResponse.status}`);
            throw new Error(`Depot fetch failed with status ${depotResponse.status}`);
        }

        const depotData = await depotResponse.json();
        const depots = depotData.depots || [];
        Log("backend", "info", "service", `got ${depots.length} depots`);

        const scheduleResults = [];

        for (const depot of depots) {
            const depotId = depot.ID;
            const mechanicHours = depot.MechanicHours;

            Log("backend", "debug", "service", `working on depot id ${depotId} (budget ${mechanicHours})`);

         
            const taskResponse = await fetch(`${BASE_URL}/vehicles`, { method: "GET", headers });

            if (!taskResponse.ok) {
                Log("backend", "warn", "handler", `couldnt fetch vehicels for depot ${depotId}. status: ${taskResponse.status}`);
                continue;
            }

            const taskData = await taskResponse.json();
            const vehicles = taskData.vehicles || taskData;

            const tasks = vehicles.map(v => ({
                id: v.TaskID,
                duration: v.Duration,
                score: v.Impact
            }));

            Log("backend", "debug", "service", `depot id ${depotId} has ${tasks.length} tasks ready`);

            const result = optimizeMaintenanceSchedule(tasks, mechanicHours);

            Log("backend", "info", "service", `depot ${depotId} optimized. score=${result.maxScore}`);


            scheduleResults.push({
                depotId,
                budget: mechanicHours,
                maxScore: result.maxScore,
                totalHoursUsed: result.totalHoursUsed,
                tasksSelected: result.selectedTasks.length,
                tasks: result.selectedTasks
            });
        }

        Log("backend", "info", "service", "scheduler done successfully");
        res.json({ success: true, schedule: scheduleResults });

    } catch (error) {
        Log("backend", "fatal", "handler", `scheduler crashed rip: ${error.message}`);
        console.error("Error executing scheduler:", error.message);
        res.status(500).json({ error: error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = { app, optimizeMaintenanceSchedule };