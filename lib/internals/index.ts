export { default as binding } from "./binding";
export { default as Queue } from "./Queue";
export { default as Request } from "./Request";

import * as state from "./state";

export { state };

// IPv4 Segment
const v4Seg = "(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])";
const v4Str = `(${v4Seg}[.]){3}${v4Seg}`;
// tslint:disable-next-line:variable-name
const IPv4Reg = new RegExp(`^${v4Str}$`);

// IPv6 Segment
const v6Seg = "(?:[0-9a-fA-F]{1,4})";
// tslint:disable-next-line:variable-name
const IPv6Reg = new RegExp(
  "^(" +
    `(?:${v6Seg}:){7}(?:${v6Seg}|:)|` +
    `(?:${v6Seg}:){6}(?:${v4Str}|:${v6Seg}|:)|` +
    `(?:${v6Seg}:){5}(?::${v4Str}|(:${v6Seg}){1,2}|:)|` +
    `(?:${v6Seg}:){4}(?:(:${v6Seg}){0,1}:${v4Str}|(:${v6Seg}){1,3}|:)|` +
    `(?:${v6Seg}:){3}(?:(:${v6Seg}){0,2}:${v4Str}|(:${v6Seg}){1,4}|:)|` +
    `(?:${v6Seg}:){2}(?:(:${v6Seg}){0,3}:${v4Str}|(:${v6Seg}){1,5}|:)|` +
    `(?:${v6Seg}:){1}(?:(:${v6Seg}){0,4}:${v4Str}|(:${v6Seg}){1,6}|:)|` +
    `(?::((?::${v6Seg}){0,5}:${v4Str}|(?::${v6Seg}){1,7}|:))` +
    ")(%[0-9a-zA-Z]{1,})?$",
);

export function isIPv4(s: string) {
  return IPv4Reg.test(s);
}

export function isIPv6(s: string) {
  return IPv6Reg.test(s);
}

export function isIP(s: string) {
  if (isIPv4(s)) return 4;

  if (isIPv6(s)) return 6;

  return 0;
}

// Check that the port number is not NaN when coerced to a number,
// is an integer and that it falls within the legal range of port numbers.
export function isLegalPort(port: string | number) {
  if (
    (typeof port !== "number" && typeof port !== "string") ||
    (typeof port === "string" && port.trim().length === 0)
  ) {
    return false;
  }

  // tslint:disable-next-line:no-bitwise
  return +port === +port >>> 0 && port <= 0xffff;
}
