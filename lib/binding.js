const path = require("path");
const binding = require("node-gyp-build")(path.join(__dirname, ".."));

binding.turbo_net_on_fatal_exception(onFatalException);

module.exports = binding;

function onFatalException(err) {
  if (process._fatalException && process._fatalException(err)) return;

  console.error(err.stack);

  process.exit(1);
}
