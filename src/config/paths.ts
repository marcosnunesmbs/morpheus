import os from 'os';
import path from 'path';

export const USER_HOME = os.homedir();
export const MORPHEUS_ROOT = path.join(USER_HOME, '.morpheus');
export const LOGS_DIR = path.join(MORPHEUS_ROOT, 'logs');

export const PATHS = {
  root: MORPHEUS_ROOT,
  config: path.join(MORPHEUS_ROOT, 'config.yaml'),
  pid: path.join(MORPHEUS_ROOT, 'morpheus.pid'),
  logs: LOGS_DIR,
  memory: path.join(MORPHEUS_ROOT, 'memory'),
  cache: path.join(MORPHEUS_ROOT, 'cache'),
  commands: path.join(MORPHEUS_ROOT, 'commands'),
  mcps: path.join(MORPHEUS_ROOT, 'mcps.json'),
};
