const webpack = require("webpack");
const { execSync } = require("child_process");

let commitHash;
try {
  commitHash = execSync("git rev-parse --short HEAD", {
    encoding: "utf8",
  }).trim();
} catch (e) {
  commitHash = "unknown";
}

const config = require("./webpack.config.js");
const compiler = webpack(
  config({ COMMIT_HASH: commitHash }, { mode: "production" }),
);

compiler.run((err, stats) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(stats.toString());
});
