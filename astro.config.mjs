// @ts-check
// @ts-check
import vercel from '@astrojs/vercel/serverless';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({adapter: vercel(),});
