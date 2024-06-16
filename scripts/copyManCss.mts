import process from "process";
import { config } from 'dotenv';
import manifest from "../manifest.json" assert { type: "json" };
import { copyFilesToTargetDir } from './utils.mts';

config();

const vaultDir = process.env.REAL ? process.env.REAL_VAULT : process.env.TEST_VAULT;
const targetDir = `${vaultDir}/.obsidian/plugins/${manifest.id}`;
const man = `${targetDir}/manifest.json`;
const css = `${targetDir}/styles.css`;

await copyFilesToTargetDir(targetDir, man, css);

