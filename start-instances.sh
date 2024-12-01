#!/bin/bash
export INSTANCE_ID=1 && pnpm start &
export INSTANCE_ID=2 && pnpm start &
export INSTANCE_ID=3 && pnpm start &
export INSTANCE_ID=4 && pnpm start &
wait 