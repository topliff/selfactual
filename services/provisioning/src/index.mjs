import "dotenv/config";
import express from "express";
import routes from "./routes.mjs";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "selfactual-provisioning" });
});

// Mount API routes
app.use("/", routes);

app.listen(PORT, () => {
  console.log(`Provisioning service listening on port ${PORT}`);
});
