import assert from "node:assert/strict";
import { parseMultipart } from "../src/server/multipart.mjs";

const boundary = "----job-agent-test-boundary";
const body = Buffer.from([
  `--${boundary}`,
  'Content-Disposition: form-data; name="minimumScore"',
  "",
  "60",
  `--${boundary}`,
  'Content-Disposition: form-data; name="targetRoleInput"',
  "",
  "Recruiter",
  `--${boundary}`,
  'Content-Disposition: form-data; name="resume"; filename="resume.txt"',
  "Content-Type: text/plain",
  "",
  "Jane Doe resume text for multipart testing.",
  `--${boundary}--`,
  ""
].join("\r\n"));

const { fields, files } = parseMultipart(
  body,
  `multipart/form-data; boundary=${boundary}`
);

assert.equal(fields.minimumScore, "60");
assert.equal(fields.targetRoleInput, "Recruiter");
assert.equal(files.resume.filename, "resume.txt");
assert.match(files.resume.buffer.toString("utf8"), /Jane Doe/);

console.log("All multipart target role tests passed.");
