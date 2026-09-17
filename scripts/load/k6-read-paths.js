import http from "k6/http";
import { check, sleep } from "k6";

const baseUrl = (__ENV.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const paths = (__ENV.PATHS || "/")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const startRps = Number(__ENV.START_RPS || 5);
const peakRps = Number(__ENV.PEAK_RPS || 50);
const preAllocatedVUs = Number(__ENV.PREALLOCATED_VUS || 20);
const maxVUs = Number(__ENV.MAX_VUS || 200);

if (!Number.isFinite(startRps) || startRps <= 0) {
  throw new Error("START_RPS must be a positive number");
}
if (!Number.isFinite(peakRps) || peakRps < startRps) {
  throw new Error("PEAK_RPS must be >= START_RPS");
}
if (paths.some((path) => !path.startsWith("/") || path.startsWith("//"))) {
  throw new Error("PATHS must contain only absolute same-origin paths");
}

export const options = {
  discardResponseBodies: true,
  scenarios: {
    read_paths: {
      executor: "ramping-arrival-rate",
      startRate: startRps,
      timeUnit: "1s",
      preAllocatedVUs,
      maxVUs,
      stages: [
        { target: startRps, duration: "30s" },
        { target: peakRps, duration: "2m" },
        { target: peakRps, duration: "2m" },
        { target: startRps, duration: "30s" },
      ],
      gracefulStop: "10s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000", "p(99)<2000"],
  },
};

let sequence = 0;

export default function () {
  const path = paths[sequence % paths.length];
  sequence += 1;

  const response = http.get(baseUrl + path, {
    redirects: 3,
    tags: { path },
    timeout: "5s",
  });

  check(response, {
    "status is not 5xx": (res) => res.status < 500,
  });

  sleep(0.05);
}
