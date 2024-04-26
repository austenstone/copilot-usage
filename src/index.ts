import run from "./run";
import { RequestError } from "@octokit/request-error";
import { setFailed } from "@actions/core";

try {
  run();
} catch (err) {
  if (err instanceof RequestError) {
    setFailed(`Request failed: (${err.status}) ${err.message}`);
  } else if (err instanceof Error) {
    setFailed(err);
  } else {
    setFailed(JSON.stringify(err, null, 2))
  }
  throw err;
}
