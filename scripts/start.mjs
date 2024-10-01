import { execSync } from 'child_process';

// just for fun
const currentEvent = process.env.npm_lifecycle_event;
console.log(`Starting the ${currentEvent} process...\n`);

// Removed 'npm ci' as it's now in package.json
console.log('- Dependencies should be installed');

//@ts-ignore
execSync("start /B code .", { stdio: "ignore", shell: true });
console.log('- Opened current folder in VSCode');

console.log("- Running 'npm run dev'");
execSync('npm run dev', { stdio: 'inherit' });
