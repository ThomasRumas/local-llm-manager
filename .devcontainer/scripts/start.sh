#!/bin/bash
npm install
npm run build
cd packages/manager && npm link
cd ../client-cli && npm link
cd ../../