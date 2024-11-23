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

function call(workDuration) {
    const end = responseDurationSeconds.startTimer()
    console.info(`Calling ${TEST_TARGET} with duration ${workDuration} url: ${TEST_TARGET}?duration=${workDuration}`);
    return fetch(`${TEST_TARGET}?duration=${workDuration}`, {
        method: "GET",
    })
    .then(response => response.status)
    .then(status => {
        end({status: status});
    })
    .catch(error => console.log(error))
}

async function runInternal(duration, workDuration) {
    const start = Date.now();
    while (Date.now() - start < duration) {
        await call(workDuration);
    }

    return true;
}

async function run(parallel, duration, workDuration) {

    const all = [];
    for (let i = 0; i < parallel; i++) {
        all.push(runInternal(duration, workDuration));
    }

    await Promise.all(all);
}

const app = express();

app.get("/run-test", (req, res) => {

    const parallel = parseInt(req.query.parallel);
    const duration = parseInt(req.query.duration);
    const workDuration = req.query.work_duration;

    run(parallel, duration * MINUTES_TO_MILLISECONDS, workDuration).then(() => {
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
