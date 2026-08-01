import "./loadEnv.js";
import { createApp, getPort } from "./app.js";

const app = createApp();
const port = getPort();

app.listen(port, () => {
  console.log(`TrustChain API listening on http://localhost:${port}`);
});
