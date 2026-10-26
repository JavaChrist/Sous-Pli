import next from "eslint-config-next";

const base = Array.isArray(next) ? next : [next];

export default [
  { ignores: [".next/**", "functions/lib/**", "functions/node_modules/**", "node_modules/**", "public/sw.js"] },
  ...base,
];
