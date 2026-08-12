import * as migration_20260808_180149_baseline from './20260808_180149_baseline';

export const migrations = [
  {
    up: migration_20260808_180149_baseline.up,
    down: migration_20260808_180149_baseline.down,
    name: '20260808_180149_baseline'
  },
];
