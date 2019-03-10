import bindings = require("bindings");

const binding = bindings("socket");

function onFatalException(err: Error) {
  if (
    (process as any)._fatalException &&
    (process as any)._fatalException(err)
  ) {
    return;
  }

  // tslint:disable-next-line:no-console
  console.error(err.stack);

  process.exit(1);
}

binding.socket_on_fatal_exception(onFatalException);

export default binding;
