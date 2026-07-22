import { register } from "node:module";

register("./test-path-alias-loader.mjs", import.meta.url);
