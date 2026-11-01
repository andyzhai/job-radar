import { readSettings } from "../../read-settings.js";
import { openJobDatabase } from "../storage/open-job-database.js";
openJobDatabase(readSettings().databasePath).close();
console.log("Local job database is ready. Run npm run collect to save jobs.");
