import app from "./app.js";

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Northstar SAT backend running on http://localhost:${PORT}`);
});
