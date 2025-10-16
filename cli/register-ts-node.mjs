import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const here = dirname(fileURLToPath(import.meta.url));
const project = resolve(here, 'tsconfig.json');

process.env.TS_NODE_PROJECT = project;

register('ts-node/esm', pathToFileURL(here + '/'));
