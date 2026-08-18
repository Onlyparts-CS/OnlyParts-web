import * as migration_20260808_180149_baseline from './20260808_180149_baseline';
import * as migration_20260818_064908_page_views from './20260818_064908_page_views';

export const migrations = [
  {
    up: migration_20260808_180149_baseline.up,
    down: migration_20260808_180149_baseline.down,
    name: '20260808_180149_baseline',
  },
  {
    up: migration_20260818_064908_page_views.up,
    down: migration_20260818_064908_page_views.down,
    name: '20260818_064908_page_views'
  },
];
