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

function call() {
    const end = responseDurationSeconds.startTimer()
    return fetch(TEST_TARGET, {
        method: "GET",
    })
    .then(response => response.status)
    .then(status => {
        end({status: status});
    })
    .catch(error => console.log(error))
}

async function runInternal(duration) {
    const start = Date.now();
    while (Date.now() - start < duration) {
        await call();
    }

    return true;
}

async function run(parallel, duration) {

    const all = [];
    for (let i = 0; i < parallel; i++) {
        all.push(runInternal(duration));
    }

    await Promise.all(all);
}

const app = express();

app.get("/run-test", (req, res) => {
    console.info(`Running test with parallel: ${req.query.parallel}, duration: ${req.query.duration}`);
    const parallel = parseInt(req.query.parallel);
    const duration = parseInt(req.query.duration);
    run(parallel, duration * MINUTES_TO_MILLISECONDS).then(() => {
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
