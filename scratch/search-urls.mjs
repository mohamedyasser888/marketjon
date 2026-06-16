import { readdirSync, statSync, readFileSync } from "fs";
import { join } from "path";

const ignoreDirs = ["node_modules", ".next", ".git"];

function walkDir(dir, callback) {
  for (const file of readdirSync(dir)) {
    const filePath = join(dir, file);
    if (statSync(filePath).isDirectory()) {
      if (!ignoreDirs.includes(file)) {
        walkDir(filePath, callback);
      }
    } else {
      if (file.endsWith(".ts") || file.endsWith(".tsx") || file.endsWith(".js") || file.endsWith(".mjs")) {
        callback(filePath);
      }
    }
  }
}

console.log("Searching for 'avatar_url' and 'photo_url'...");
walkDir(".", (filePath) => {
  const content = readFileSync(filePath, "utf8");
  if (content.includes("avatar_url")) {
    console.log(`Found 'avatar_url' in: ${filePath}`);
  }
  if (content.includes("photo_url")) {
    console.log(`Found 'photo_url' in: ${filePath}`);
  }
});
