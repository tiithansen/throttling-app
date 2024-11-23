const express = require("express");
const promClient = require("prom-client");

const MINUTES_TO_MILLISECONDS = 60 * 1000;
const TEST_TARGET = process.env.TEST_TARGET;

const responseDurationSeconds = new promClient.Histogram({
    name: "response_duration_seconds",
    help: "Response duration in seconds",
    labelNames: ["status"],
    buckets: [.005, .01, .025, .05, .075, .1, .125, .15, .175, .2, .25, .3, .4, .5, 1, 2.5, 5, 10]
});

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function call(workDuration) {
    const end = responseDurationSeconds.startTimer()
    return fetch(`${TEST_TARGET}?duration=${workDuration}`, {
        method: "GET",
    })
    .then(response => response.status)
    .then(status => {
        end({status: status});
    })
    .catch(error => console.log(error))
}

async function runInternal(duration, workDuration, parallelBurst, delay) {
    
    const start = Date.now();
    while (Date.now() - start < duration) {
        const burst = [];
        for (let i = 0; i < parallelBurst; i++) {
            burst.push(call(workDuration));
        }

        await Promise.all(burst);
        
        await sleep(delay);
    }

    return true;
}

async function run(parallel, duration, workDuration, parallelBurst, delay) {

    const all = [];
    for (let i = 0; i < parallel; i++) {
        all.push(runInternal(duration, workDuration, parallelBurst, delay));
    }

    await Promise.all(all);
}

const app = express();

app.get("/run-test", (req, res) => {

    const parallel = parseInt(req.query.parallel);
    const duration = parseInt(req.query.duration);
    const workDuration = req.query.work_duration;
    const delay = parseInt(req.query.delay);
    const parallelBurst = parseInt(req.query.parallel_burst);

    console.info(`Running test with parallel=${parallel}, duration=${duration}, workDuration=${workDuration}, parallelBurst=${parallelBurst}, delay=${delay}`);
    run(parallel, duration * MINUTES_TO_MILLISECONDS, workDuration, parallelBurst, delay).then(() => {
        console.info(`Test completed`);
    });
    res.send("OK");
})

app.get("/metrics", (req, res) => {
    res.set("Content-Type", promClient.register.contentType);
    promClient.register.metrics().then(metrics => {
        res.send(metrics);
    });
})

app.get("/-/ready", (req, res) => {
    res.send("OK");
})

app.listen(8080, () => {
    console.info("Server is running on port 8080");
})
